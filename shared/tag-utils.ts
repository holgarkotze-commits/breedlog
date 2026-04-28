export type NormalizedTagParts = {
  studPrefix: string;
  rawTag: string;
  canonicalTag: string;
};

export function normalizeStudPrefix(prefix?: string | null): string {
  return (prefix || '').replace(/\s+/g, '').toUpperCase();
}

export function normalizeRawTag(raw?: string | null): string {
  const compact = (raw || '').trim().toUpperCase();
  if (!compact) return '';
  return compact
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
}

export function splitTagInput(input?: string | null, prefix?: string | null): NormalizedTagParts {
  const normalizedPrefix = normalizeStudPrefix(prefix);
  const normalizedInput = normalizeRawTag(input);

  if (!normalizedInput) {
    return { studPrefix: normalizedPrefix, rawTag: '', canonicalTag: '' };
  }

  let rawTag = normalizedInput;
  if (normalizedPrefix && normalizedInput.startsWith(normalizedPrefix)) {
    rawTag = normalizedInput.slice(normalizedPrefix.length);
    if (rawTag.startsWith('-')) rawTag = rawTag.slice(1);
    rawTag = normalizeRawTag(rawTag);
  }

  const canonicalTag = normalizedPrefix ? `${normalizedPrefix}${rawTag}` : rawTag;
  return {
    studPrefix: normalizedPrefix,
    rawTag,
    canonicalTag,
  };
}

export function canonicalizeTag(input?: string | null, prefix?: string | null): string {
  return splitTagInput(input, prefix).canonicalTag;
}

export function nextTagRawSequence(existingCanonicalTags: Array<string | null | undefined>, prefix: string | null | undefined, year: number): string {
  const normalizedPrefix = normalizeStudPrefix(prefix);
  const yearSuffix = String(year).slice(-2);
  const pattern = new RegExp(`^${normalizedPrefix}${yearSuffix}-(\\d{3,})$`);

  let max = 0;
  for (const tag of existingCanonicalTags) {
    const normalizedTag = normalizeRawTag(tag);
    const match = normalizedTag.match(pattern);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }

  return `${yearSuffix}-${String(max + 1).padStart(3, '0')}`;
}
