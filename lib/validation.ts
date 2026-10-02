const FEED_ID_PATTERN = /^\d+$/;

/**
 * Podcast feed ids are positive integers. `Number()` alone is too permissive:
 * it accepts '', ' 1', '1e3', '0x10' and NaN, all of which reach the upstream
 * API as a junk id and waste a request.
 */
export function parseFeedId(raw: string | null): number | null {
  if (raw === null || !FEED_ID_PATTERN.test(raw)) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return id;
}