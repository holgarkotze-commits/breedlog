/**
 * BreedLog Telemetry Client
 * Non-breaking, offline-capable, sendBeacon-first, never crashes the app.
 */

const SESSION_KEY = "breedlog_telemetry_session_id";
const QUEUE_KEY = "breedlog_telemetry_queue";
const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds
const SESSION_TIMEOUT_MS = 3 * 60_000; // 3 minutes — if no heartbeat, session is dead

let _sessionId: string | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastHeartbeat = 0;
let _flushing = false;

// ── Session ID ────────────────────────────────────────────────────────────────

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) { _sessionId = stored; return _sessionId; }
  } catch { /* sessionStorage unavailable */ }
  _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try { sessionStorage.setItem(SESSION_KEY, _sessionId); } catch { /* ok */ }
  return _sessionId;
}

// ── Offline queue ─────────────────────────────────────────────────────────────

interface QueuedEvent {
  eventType: string;
  eventCategory?: string;
  route?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  sessionId: string;
}

function loadQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedEvent[];
  } catch { return []; }
}

function saveQueue(q: QueuedEvent[]): void {
  try {
    // Cap queue at 100 items to avoid unbounded growth
    const capped = q.slice(-100);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(capped));
  } catch { /* storage unavailable */ }
}

function enqueue(ev: QueuedEvent): void {
  const q = loadQueue();
  q.push(ev);
  saveQueue(q);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function getDeviceToken(): string | null {
  try {
    return localStorage.getItem("breedlog_device_token") ?? null;
  } catch { return null; }
}

function buildHeaders(): Record<string, string> {
  const token = getDeviceToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function sendBeaconOrFetch(url: string, body: object): void {
  try {
    const payload = JSON.stringify(body);
    // Always use fetch — sendBeacon cannot set Authorization headers
    fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      body: payload,
      keepalive: true,
    }).catch(() => { /* silent */ });
  } catch { /* never crash */ }
}

// ── Core send ─────────────────────────────────────────────────────────────────

function sendEvent(eventType: string, opts: {
  eventCategory?: string;
  route?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
} = {}): void {
  try {
    const ev: QueuedEvent = {
      eventType,
      eventCategory: opts.eventCategory,
      route: opts.route,
      feature: opts.feature,
      metadata: opts.metadata,
      occurredAt: new Date().toISOString(),
      sessionId: getSessionId(),
    };

    if (!navigator.onLine) {
      enqueue(ev);
      return;
    }

    sendBeaconOrFetch("/api/activity/event", ev);
  } catch { /* never crash */ }
}

// ── Offline queue flush ───────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  if (_flushing || !navigator.onLine) return;
  const q = loadQueue();
  if (q.length === 0) return;
  _flushing = true;
  try {
    const remaining: QueuedEvent[] = [];
    for (const ev of q) {
      try {
        const res = await fetch("/api/activity/event", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(ev),
        });
        if (!res.ok) remaining.push(ev); // keep for retry
      } catch {
        remaining.push(ev);
        break; // stop on network error
      }
    }
    saveQueue(remaining);
  } catch { /* ok */ } finally {
    _flushing = false;
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

function sendHeartbeat(): void {
  try {
    if (document.hidden) return;
    const sessionId = getSessionId();
    fetch("/api/activity/session/heartbeat", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => { /* silent */ });
    _lastHeartbeat = Date.now();
  } catch { /* never crash */ }
}

function startHeartbeat(): void {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

// ── Visibility change ─────────────────────────────────────────────────────────

function handleVisibilityChange(): void {
  try {
    if (document.hidden) {
      sendEvent("app_background", { eventCategory: "session" });
      stopHeartbeat();
    } else {
      sendEvent("app_foreground", { eventCategory: "session" });
      startHeartbeat();
      flushQueue().catch(() => {});
    }
  } catch { /* never crash */ }
}

// ── Online/offline ─────────────────────────────────────────────────────────────

function handleOnline(): void {
  try {
    sendEvent("online_restored", { eventCategory: "connectivity" });
    flushQueue().catch(() => {});
  } catch { /* never crash */ }
}

function handleOffline(): void {
  try {
    sendEvent("offline_detected", { eventCategory: "connectivity" });
  } catch { /* never crash */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initTelemetry(): void {
  try {
    // app_open
    sendEvent("app_open", { eventCategory: "session" });

    // Start heartbeat
    startHeartbeat();
    sendHeartbeat();

    // Visibility
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Online / offline
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Flush any queued events from previous offline sessions
    flushQueue().catch(() => {});
  } catch { /* never crash */ }
}

export function trackRouteView(route: string): void {
  try {
    sendEvent("route_view", { eventCategory: "navigation", route });
  } catch { /* never crash */ }
}

export function trackEvent(eventType: string, opts: {
  eventCategory?: string;
  route?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
} = {}): void {
  try {
    sendEvent(eventType, opts);
  } catch { /* never crash */ }
}

export function destroyTelemetry(): void {
  try {
    stopHeartbeat();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  } catch { /* never crash */ }
}
