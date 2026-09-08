/**
 * Streak calculation (PRD Section 9, 14, 38): consecutive days a user met
 * their daily goal. `dailyGoalMetByDate` should be a map of ISO date string
 * ("YYYY-MM-DD") -> whether the goal was met that day, for one user.
 */
export function currentStreak(dailyGoalMetByDate: Record<string, boolean>, asOfDateIso: string): number {
  let streak = 0;
  let cursor = new Date(asOfDateIso + "T00:00:00Z");

  // Walk backwards from today while the goal keeps being met.
  // Missing a day (no data at all) is *not* the same as failing it - many
  // real users skip logging on weekends - so only an explicit `false` breaks
  // the streak; an absent key just means "no activity synced yet".
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    const met = dailyGoalMetByDate[key];
    if (met === false) break;
    if (met === true) streak += 1;
    if (met === undefined && streak > 0) break;
    if (met === undefined && streak === 0) break;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (streak > 3650) break; // safety valve
  }
  return streak;
}

/** How many streak-bonus milestones a streak of this length has crossed, e.g. every 3 days. */
export function streakMilestonesReached(streakDays: number, milestoneEveryDays: number): number {
  if (milestoneEveryDays <= 0) return 0;
  return Math.floor(streakDays / milestoneEveryDays);
}
