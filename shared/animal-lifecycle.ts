export function resolveBirthWeight(weight: string | null | undefined, isEstimated: boolean | null | undefined): { value: string | null; estimated: boolean } {
  const trimmed = (weight || '').trim();
  if (trimmed) {
    return { value: trimmed, estimated: false };
  }
  return { value: null, estimated: !!isEstimated };
}

export function resolveWeaningWeight(weight: string | null | undefined, isEstimated: boolean | null | undefined): { value: string | null; estimated: boolean } {
  const trimmed = (weight || '').trim();
  if (trimmed) {
    return { value: trimmed, estimated: false };
  }
  return { value: null, estimated: !!isEstimated };
}

export function isMetricWeight(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^\d+(\.\d+)?$/.test(value.trim());
}
