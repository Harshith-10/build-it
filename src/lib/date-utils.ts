/**
 * Returns today's date string in YYYY-MM-DD format using IST (Asia/Kolkata).
 *
 * Why IST? The server may run in any timezone (UTC on most clouds),
 * but our users are in India, so "today" must always mean the Indian date.
 * This avoids the bug where `new Date().toISOString().split("T")[0]`
 * gives yesterday's date after 18:30 UTC (midnight IST).
 */
export function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  // "en-CA" locale formats as YYYY-MM-DD which matches our DB date format
}

/**
 * Returns the number of milliseconds until the next midnight IST.
 * Useful for scheduling client-side problem rotation.
 */
export function msUntilMidnightIST(): number {
  const now = new Date();

  // Get the current IST time components
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istNow = new Date(istString);

  // Next midnight IST
  const nextMidnight = new Date(istNow);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  // Difference in ms
  return nextMidnight.getTime() - istNow.getTime();
}
