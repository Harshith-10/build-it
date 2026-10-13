/**
 * Utility functions for reports and assessment naming conventions.
 */

/**
 * Extracts a week number from an assessment or exam title.
 * Matches patterns like:
 * - OOPL_W1, OOPL_W02 -> 1, 2
 * - OOPL_Week_3, OOPL_Week 4 -> 3, 4
 * - OOPL-W5 -> 5
 * - W6, Week 7 -> 6, 7
 */
export function extractWeekNoFromTitle(title: string): number | null {
  if (!title) return null;
  const match = title.match(/(?:^|[_\s\-])(?:week|w)[_ \-]*(\d+)/i);
  if (match?.[1]) {
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
