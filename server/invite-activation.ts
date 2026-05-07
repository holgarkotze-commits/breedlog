// === SHARED INVITE-CODE ACTIVATION SERVICE ===
// Single source of truth used by BOTH the admin diagnostic lookup
// (/api/admin/invite-codes/lookup/:code) and the real activation endpoint
// (/api/beta/validate). Centralising this logic eliminates drift between
// what the admin panel says is possible and what activation actually does.
//
// Pure functions only — no DB, no I/O, no Express. Callers pass in the
// invite code row plus the list of currently-active activations for that
// code, and ask "can deviceType X claim a slot here?". Slot freeing /
// re-claiming is expressed as user_activations row UPDATE (revive) by the
// caller; this module never touches storage.

import type { InviteCode, UserActivation } from "@shared/schema";

export type ActivationReasonCode =
  | "OK"
  | "CODE_NOT_FOUND"
  | "CODE_REVOKED"
  | "CODE_EXPIRED"
  | "DEVICE_SLOT_ALREADY_USED"
  | "INVALID_DEVICE_TYPE"
  | "WORKSPACE_MISSING"
  | "ACTIVATION_STATE_MISMATCH"
  | "UNKNOWN_ACTIVATION_ERROR";

export type CodeStatus = "active" | "revoked" | "expired";

export type DeviceType = "desktop" | "mobile";

export interface ActivationDecision {
  ok: boolean;
  reasonCode: ActivationReasonCode;
  reason: string | null;
  /** True when the requested slot is occupied by a *different* device. */
  slotTaken: boolean;
  /** True when the requested slot is occupied by the *requesting* device itself. */
  selfHoldsSlot: boolean;
}

export function getCodeStatus(code: Pick<InviteCode, "status" | "expiresAt"> | null | undefined): CodeStatus {
  if (!code) return "expired";
  if (code.status === "revoked") return "revoked";
  if (code.status === "expired") return "expired";
  if (new Date(code.expiresAt as any) < new Date()) return "expired";
  return "active";
}

export function getCodeBlockReason(code: Pick<InviteCode, "status" | "expiresAt"> | null | undefined): string | null {
  const status = getCodeStatus(code);
  if (status === "revoked") return "Code has been revoked";
  if (status === "expired") return "Code has expired";
  return null;
}

export function isValidDeviceType(value: unknown): value is DeviceType {
  return value === "desktop" || value === "mobile";
}

/**
 * Decide whether the requesting device can claim its slot on this code.
 *
 * Inputs:
 *  - code: the invite code row, or null/undefined if not found.
 *  - activeActivationsForCode: every user_activations row for THIS code with status='active'.
 *  - requestedDeviceType: 'desktop' or 'mobile'.
 *  - callerDeviceId: optional — when provided, a slot occupied by this exact deviceId
 *    is treated as "the caller already owns it" (selfHoldsSlot=true) rather than
 *    "blocked by someone else".
 *
 * Output: a single ActivationDecision the caller can act on.
 */
export function evaluateActivation(params: {
  code: InviteCode | null | undefined;
  activeActivationsForCode: UserActivation[];
  requestedDeviceType: DeviceType | string;
  callerDeviceId?: string;
}): ActivationDecision {
  const { code, activeActivationsForCode, requestedDeviceType, callerDeviceId } = params;

  if (!code) {
    return {
      ok: false,
      reasonCode: "CODE_NOT_FOUND",
      reason: "Code not found. Please check and try again.",
      slotTaken: false,
      selfHoldsSlot: false,
    };
  }

  if (!isValidDeviceType(requestedDeviceType)) {
    return {
      ok: false,
      reasonCode: "INVALID_DEVICE_TYPE",
      reason: "Device type must be desktop or mobile.",
      slotTaken: false,
      selfHoldsSlot: false,
    };
  }

  const status = getCodeStatus(code);
  if (status === "revoked") {
    return {
      ok: false,
      reasonCode: "CODE_REVOKED",
      reason: "This code has been revoked.",
      slotTaken: false,
      selfHoldsSlot: false,
    };
  }
  if (status === "expired") {
    return {
      ok: false,
      reasonCode: "CODE_EXPIRED",
      reason: "This code has expired.",
      slotTaken: false,
      selfHoldsSlot: false,
    };
  }

  const slotHolder = activeActivationsForCode.find(
    (a) => a.deviceType === requestedDeviceType && a.status === "active",
  );

  if (slotHolder) {
    const selfHolds = !!callerDeviceId && slotHolder.deviceId === callerDeviceId;
    if (selfHolds) {
      return {
        ok: true,
        reasonCode: "OK",
        reason: null,
        slotTaken: true,
        selfHoldsSlot: true,
      };
    }
    const slotLabel = requestedDeviceType === "desktop" ? "desktop" : "mobile";
    return {
      ok: false,
      reasonCode: "DEVICE_SLOT_ALREADY_USED",
      reason: `The ${slotLabel} slot for this code is already taken. One desktop and one mobile device are allowed per code. Contact the admin to reset your ${slotLabel} slot.`,
      slotTaken: true,
      selfHoldsSlot: false,
    };
  }

  return { ok: true, reasonCode: "OK", reason: null, slotTaken: false, selfHoldsSlot: false };
}

/**
 * Per-slot summary the admin diagnostic returns. Driven by exactly the same
 * `evaluateActivation` calls the real activation path uses, so admin lookup
 * and activation cannot disagree on availability.
 */
export interface SlotSummary {
  taken: boolean;
  deviceId?: string;
  activatedAt?: Date | string | null;
  canActivate: boolean;
  reason: string | null;
  reasonCode: ActivationReasonCode;
}

export function summarizeSlot(params: {
  code: InviteCode | null | undefined;
  activeActivationsForCode: UserActivation[];
  deviceType: DeviceType;
}): SlotSummary {
  const { code, activeActivationsForCode, deviceType } = params;
  const decision = evaluateActivation({
    code,
    activeActivationsForCode,
    requestedDeviceType: deviceType,
  });
  const holder = activeActivationsForCode.find(
    (a) => a.deviceType === deviceType && a.status === "active",
  );
  return {
    taken: !!holder,
    deviceId: holder?.deviceId,
    activatedAt: holder?.activatedAt ?? null,
    canActivate: decision.ok,
    reason: decision.reason,
    reasonCode: decision.reasonCode,
  };
}
