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

/** Which teams reached a given chapter's destination first, for first/second-place VP bonuses. */
export function rankTeamsByChapterArrival(
  teamsCumulativePoints: Array<{ teamId: string; cumulativeMovementPoints: number }>,
  chapterGoal: number
): string[] {
  return teamsCumulativePoints
    .filter((t) => t.cumulativeMovementPoints >= chapterGoal)
    .sort((a, b) => b.cumulativeMovementPoints - a.cumulativeMovementPoints)
    .map((t) => t.teamId);
}
