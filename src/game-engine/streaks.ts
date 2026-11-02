/**
 * Streak calculation (PRD Section 9, 14, 38): consecutive days a user met
 * their daily goal. `dailyGoalMetByDate` should be a map of ISO date string
 * ("YYYY-MM-DD") -> whether the goal was met that day, for one user.
 */
export function currentStreak(dailyGoalMetByDate: Record<string, boolean>, asOfDateIso: string): number {
  let streak = 0;
  const cursor = new Date(asOfDateIso + "T00:00:00Z");

  // The as-of day is still in progress: not having hit the goal yet (or not
  // having synced at all yet) shouldn't wipe out yesterday's streak, so it
  // only counts if it's already met, and otherwise we start from yesterday.
  if (dailyGoalMetByDate[asOfDateIso] !== true) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Walk backwards while the goal keeps being met. Any earlier day that
  // was missed or has no data at all ends the streak.
  while (dailyGoalMetByDate[cursor.toISOString().slice(0, 10)] === true) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (streak > 3650) break; // safety valve
  }
  return streak;
}

/**
 * Lengths of every streak (run of consecutive goal-met days) in the
 * history, in date order. A missed day or a day with no data ends a run.
 */
export function streakRuns(dailyGoalMetByDate: Record<string, boolean>): number[] {
  const metDays = Object.keys(dailyGoalMetByDate)
    .filter((day) => dailyGoalMetByDate[day])
    .sort();
  const runs: number[] = [];
  let previous: number | null = null;
  for (const day of metDays) {
    const t = Date.parse(day + "T00:00:00Z");
    if (previous !== null && t - previous === 24 * 60 * 60 * 1000) runs[runs.length - 1] += 1;
    else runs.push(1);
    previous = t;
  }
  return runs;
}

/** How many streak-bonus milestones a streak of this length has crossed, e.g. every 3 days. */
export function streakMilestonesReached(streakDays: number, milestoneEveryDays: number): number {
  if (milestoneEveryDays <= 0) return 0;
  return Math.floor(streakDays / milestoneEveryDays);
}
