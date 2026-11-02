import type { TeamProgress } from "../shared/types.js";

export interface ChapterDef {
  order: number;
  name: string;
  distanceGoal: number; // cumulative movement points needed to *reach* this chapter's destination
}

/**
 * Given a team's total cumulative movement points and the ordered list of
 * chapters (PRD Section 7-8), figure out which chapter they're currently in
 * and how far through it they are. Chapter goals are cumulative thresholds,
 * so chapter N's distanceGoal is the total distance from the start of the
 * challenge, not just that chapter's length.
 */
export function computeTeamProgress(teamId: string, cumulativeMovementPoints: number, chapters: ChapterDef[]): TeamProgress {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);

  let currentChapter = sorted[0];
  let previousGoal = 0;

  for (const chapter of sorted) {
    if (cumulativeMovementPoints < chapter.distanceGoal) {
      currentChapter = chapter;
      break;
    }
    previousGoal = chapter.distanceGoal;
    currentChapter = chapter;
  }

  const isFinished = sorted.length > 0 && cumulativeMovementPoints >= sorted[sorted.length - 1].distanceGoal;
  const chapterSpan = Math.max(currentChapter.distanceGoal - previousGoal, 1);
  const intoChapter = Math.max(cumulativeMovementPoints - previousGoal, 0);

  return {
    teamId,
    currentChapterOrder: currentChapter.order,
    movementPointsIntoChapter: Math.min(intoChapter, chapterSpan),
    chapterDistanceGoal: currentChapter.distanceGoal,
    percentComplete: isFinished
      ? 100
      : Math.min(100, Math.round((intoChapter / chapterSpan) * 100)),
  };
}

/** Movement points a team earned, and when (e.g. one entry per activity, at its endTime). */
export interface MovementPointsEvent {
  at: Date;
  points: number;
}

/**
 * Which teams reached a given chapter's destination, in the order they got
 * there, for first/second-place VP bonuses. Order is by the moment each
 * team's running total first crossed the goal - not by current totals, or a
 * team that arrived later but has since pulled ahead would steal "first to
 * destination". Teams arriving at the same instant are tie-broken by the
 * larger running total at that moment.
 */
export function rankTeamsByChapterArrival(
  teams: Array<{ teamId: string; events: MovementPointsEvent[] }>,
  chapterGoal: number
): string[] {
  const arrivals: Array<{ teamId: string; arrivedAt: number; totalAtArrival: number }> = [];
  for (const team of teams) {
    const events = [...team.events].sort((a, b) => a.at.getTime() - b.at.getTime());
    let total = 0;
    for (const event of events) {
      total += event.points;
      if (total >= chapterGoal) {
        arrivals.push({ teamId: team.teamId, arrivedAt: event.at.getTime(), totalAtArrival: total });
        break;
      }
    }
  }
  return arrivals
    .sort((a, b) => a.arrivedAt - b.arrivedAt || b.totalAtArrival - a.totalAtArrival)
    .map((a) => a.teamId);
}
