const SECRET_KEY_PATTERN = /(token|secret|password|authorization|api[_-]?key|cookie|session|signature|payment|card|iban|accountNumber)/i;
const SENSITIVE_VALUE_PATTERN = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|\b[A-Fa-f0-9]{32,}\b/g;

export type BreedLogLogLevel = "debug" | "info" | "warn" | "error";

export type BreedLogLogEvent = {
  level: BreedLogLogLevel;
  event: string;
  timestamp: string;
  accountId?: string;
  workspaceId?: string;
  route?: string;
  metadata?: unknown;
};

export function redactForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value.replace(SENSITIVE_VALUE_PATTERN, "[REDACTED]");
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactForLog(item);
    }
    return result;
  }
  return "[UNSERIALIZABLE]";
}

export function createLogEvent(input: Omit<BreedLogLogEvent, "timestamp"> & { timestamp?: string }): BreedLogLogEvent {
  return {
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: redactForLog(input.metadata),
  };
}

export function buildHealthSignal(
  checks: Record<string, "pass" | "warn" | "fail" | "blocked">,
): { status: "pass" | "warn" | "fail" | "blocked"; checks: typeof checks } {
  const values = Object.values(checks);
  const status = values.includes("fail") ? "fail"
    : values.includes("blocked") ? "blocked"
    : values.includes("warn") ? "warn"
    : "pass";
  return { status, checks };
}
