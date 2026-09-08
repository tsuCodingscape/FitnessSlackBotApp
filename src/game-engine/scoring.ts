import type { NormalizedActivity, ScoringConfig } from "../shared/types.js";

/**
 * Converts a single normalized activity into "movement points" - the unit
 * that drives game-board / chapter progress (PRD Section 9).
 *
 * Different activity types are converted independently and summed, so a
 * challenge that scores steps, exercise minutes, and distance doesn't
 * double-count the same effort three different ways; each activity record
 * is one of {steps | exercise_minutes | distance | calories | active_day}.
 */
export function movementPointsForActivity(
  activity: Pick<NormalizedActivity, "activityType" | "steps" | "durationMinutes" | "distanceMeters">,
  config: ScoringConfig
): number {
  switch (activity.activityType) {
    case "steps":
      return Math.floor((activity.steps ?? 0) / config.conversion.stepsPerMovementPoint);
    case "exercise_minutes":
      return Math.floor((activity.durationMinutes ?? 0) / config.conversion.minutesPerMovementPoint);
    case "distance":
      return Math.floor((activity.distanceMeters ?? 0) / config.conversion.metersPerMovementPoint);
    case "active_day":
      return 0; // active_day contributes to streaks, not raw movement
    case "calories":
      return 0; // tracked for optional display only by default
    default:
      return 0;
  }
}

export function sumMovementPoints(
  activities: Array<Pick<NormalizedActivity, "activityType" | "steps" | "durationMinutes" | "distanceMeters">>,
  config: ScoringConfig
): number {
  return activities.reduce((total, a) => total + movementPointsForActivity(a, config), 0);
}

/**
 * Did this user's activity on a given day meet the challenge's daily goal?
 * Used both for "daily team goal" VP and for streak calculation.
 */
export function metDailyGoal(dailySteps: number, config: ScoringConfig): boolean {
  return dailySteps >= config.conversion.dailyGoalSteps;
}

/**
 * Blended team score per PRD Section 40: avoid a pure step-count arms race
 * by combining several normalized (0-1) sub-scores with admin-configurable
 * weights. Each sub-score should already be normalized by the caller
 * (e.g. "this team's VP from objectives" / "max VP from objectives across
 * all teams") before being passed in here.
 */
export interface BlendedScoreInputs {
  teamObjectivesScore: number; // 0-1
  individualConsistencyScore: number; // 0-1
  rawActivityScore: number; // 0-1
  challengesAndEventsScore: number; // 0-1
  achievementsScore: number; // 0-1
}

export function blendedTeamScore(inputs: BlendedScoreInputs, config: ScoringConfig): number {
  const w = config.weights;
  const totalWeight =
    w.teamObjectives + w.individualConsistency + w.rawActivity + w.challengesAndEvents + w.achievements;

  const raw =
    inputs.teamObjectivesScore * w.teamObjectives +
    inputs.individualConsistencyScore * w.individualConsistency +
    inputs.rawActivityScore * w.rawActivity +
    inputs.challengesAndEventsScore * w.challengesAndEvents +
    inputs.achievementsScore * w.achievements;

  // Defensive normalization in case an admin's weights don't sum to exactly 1.0.
  return totalWeight > 0 ? raw / totalWeight : 0;
}
