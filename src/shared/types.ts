/**
 * Shared types used across the game engine, providers, API, and Slack app.
 * Keeping these in one place is what lets the "scoring config" be a JSON
 * blob in the DB (Challenge.scoringConfig) while still being type-checked
 * everywhere it's read.
 */

export type ActivityType =
  | "steps"
  | "exercise_minutes"
  | "distance"
  | "calories"
  | "active_day";

export type ProviderKey =
  | "apple_health"
  | "garmin"
  | "fitbit"
  | "google_health_connect"
  | "samsung_health"
  | "oura"
  | "manual"
  | "mock";

/** The normalized shape every provider's raw payload is converted into (PRD Section 32). */
export interface NormalizedActivity {
  userId: string;
  provider: ProviderKey;
  activityType: ActivityType;
  startTime: Date;
  endTime: Date;
  steps?: number;
  distanceMeters?: number;
  durationMinutes?: number;
  calories?: number;
  /** Provider-native identifier, used for de-dup across multiple connected sources. */
  sourceId: string;
}

/**
 * Fully admin-configurable scoring rules (PRD Section 10, 40).
 * Two layers:
 *  - `conversion`: how raw activity converts into "movement points" (which
 *    drive board/chapter progress) - e.g. 1000 steps = 10 movement points.
 *  - `vp`: fixed Victory-Point awards for discrete accomplishments.
 *  - `weights`: the anti-"step arms race" blend (Section 40) - what fraction
 *    of a team's final standing comes from objectives vs. consistency vs.
 *    raw activity vs. challenges vs. achievements. Must sum to 1.0.
 */
export interface ScoringConfig {
  conversion: {
    stepsPerMovementPoint: number; // e.g. 100 steps = 1 movement point
    minutesPerMovementPoint: number; // exercise minutes
    metersPerMovementPoint: number; // distance
    dailyGoalSteps: number; // used for "reached daily team goal" style VP
  };
  vp: {
    dailyTeamGoal: number;
    chapterReached: number;
    firstToDestination: number;
    secondToDestination: number;
    chapterCompleteBonus: number;
    sideQuestComplete: number;
    obstacleDefeated: number;
    streakBonus: number; // awarded per streak milestone (e.g. every 3 or 7 days)
    streakMilestoneDays: number;
    weeklyBonus: number;
    participationBonus: number;
  };
  weights: {
    teamObjectives: number;
    individualConsistency: number;
    rawActivity: number;
    challengesAndEvents: number;
    achievements: number;
  };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  conversion: {
    stepsPerMovementPoint: 100,
    minutesPerMovementPoint: 1,
    metersPerMovementPoint: 10,
    dailyGoalSteps: 8000,
  },
  vp: {
    dailyTeamGoal: 1,
    chapterReached: 1,
    firstToDestination: 3,
    secondToDestination: 2,
    chapterCompleteBonus: 1,
    sideQuestComplete: 2,
    obstacleDefeated: 1,
    streakBonus: 1,
    streakMilestoneDays: 3,
    weeklyBonus: 2,
    participationBonus: 1,
  },
  weights: {
    teamObjectives: 0.4,
    individualConsistency: 0.25,
    rawActivity: 0.2,
    challengesAndEvents: 0.1,
    achievements: 0.05,
  },
};

export interface LeaderboardEntry {
  id: string; // team id or user id, depending on scope
  name: string;
  emoji?: string;
  vp: number;
  movementPoints: number;
  rank: number;
}

export interface TeamProgress {
  teamId: string;
  currentChapterOrder: number;
  movementPointsIntoChapter: number;
  chapterDistanceGoal: number;
  percentComplete: number;
}
