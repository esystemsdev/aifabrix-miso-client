/**
 * Utilities for deterministic trace field resolution.
 */

/**
 * Normalize unknown value to non-empty string.
 * Empty and whitespace-only strings are treated as missing.
 */
export function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

/**
 * Pick first non-empty string from candidate list.
 */
export function pickFirstNonEmpty(
  ...candidates: unknown[]
): string | undefined {
  for (const candidate of candidates) {
    const normalized = toNonEmptyString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
