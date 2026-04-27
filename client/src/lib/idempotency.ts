const RECENT_OPERATION_TTL_MS = 15_000;
const recentOperations = new Map<string, { operationId: string; expiresAt: number }>();

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildCreateFingerprint(entity: string, payload: Record<string, unknown>): string {
  const fields = [
    normalizeString(payload.tagId),
    normalizeString(payload.electronicId),
    normalizeString(payload.sex),
    normalizeString(payload.birthDate),
    normalizeString(payload.name),
  ];
  return `${entity}:${fields.join("|")}`;
}

export function getOrCreateOperationId(entity: string, payload: Record<string, unknown>): string {
  const key = buildCreateFingerprint(entity, payload);
  const now = Date.now();
  const existing = recentOperations.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.operationId;
  }

  const operationId = crypto.randomUUID();
  recentOperations.set(key, { operationId, expiresAt: now + RECENT_OPERATION_TTL_MS });
  return operationId;
}

export function clearExpiredOperationCache(): void {
  const now = Date.now();
  for (const [key, value] of recentOperations.entries()) {
    if (value.expiresAt <= now) {
      recentOperations.delete(key);
    }
  }
}
