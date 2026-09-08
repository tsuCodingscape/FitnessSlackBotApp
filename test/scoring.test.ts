import { describe, it, expect } from "vitest";
import { DEFAULT_SCORING_CONFIG } from "../src/shared/types.js";
import { movementPointsForActivity, sumMovementPoints, metDailyGoal, blendedTeamScore } from "../src/game-engine/scoring.js";

describe("movementPointsForActivity", () => {
  it("converts steps using the configured ratio", () => {
    expect(movementPointsForActivity({ activityType: "steps", steps: 10000 }, DEFAULT_SCORING_CONFIG)).toBe(100);
  });

  it("converts exercise minutes 1:1 by default", () => {
    expect(movementPointsForActivity({ activityType: "exercise_minutes", durationMinutes: 45 }, DEFAULT_SCORING_CONFIG)).toBe(45);
  });

  it("converts distance using the configured ratio", () => {
    expect(movementPointsForActivity({ activityType: "distance", distanceMeters: 5000 }, DEFAULT_SCORING_CONFIG)).toBe(500);
  });

  it("gives zero movement points for calories and active_day by default", () => {
    expect(movementPointsForActivity({ activityType: "calories" }, DEFAULT_SCORING_CONFIG)).toBe(0);
    expect(movementPointsForActivity({ activityType: "active_day" }, DEFAULT_SCORING_CONFIG)).toBe(0);
  });

  it("floors partial movement points rather than rounding up", () => {
    expect(movementPointsForActivity({ activityType: "steps", steps: 150 }, DEFAULT_SCORING_CONFIG)).toBe(1);
  });
});

describe("sumMovementPoints", () => {
  it("sums across a mixed batch of activity types", () => {
    const total = sumMovementPoints(
      [
        { activityType: "steps", steps: 10000 },
        { activityType: "exercise_minutes", durationMinutes: 30 },
      ],
      DEFAULT_SCORING_CONFIG
    );
    expect(total).toBe(130);
  });
});

describe("metDailyGoal", () => {
  it("is true at or above the configured daily step goal", () => {
    expect(metDailyGoal(DEFAULT_SCORING_CONFIG.conversion.dailyGoalSteps, DEFAULT_SCORING_CONFIG)).toBe(true);
    expect(metDailyGoal(DEFAULT_SCORING_CONFIG.conversion.dailyGoalSteps - 1, DEFAULT_SCORING_CONFIG)).toBe(false);
  });
});

describe("blendedTeamScore", () => {
  it("weights sub-scores per the configured breakdown (Section 40 anti-arms-race blend)", () => {
    const perfectAcrossTheBoard = blendedTeamScore(
      {
        teamObjectivesScore: 1,
        individualConsistencyScore: 1,
        rawActivityScore: 1,
        challengesAndEventsScore: 1,
        achievementsScore: 1,
      },
      DEFAULT_SCORING_CONFIG
    );
    expect(perfectAcrossTheBoard).toBeCloseTo(1, 5);

    // A team that's all raw-activity and nothing else should score lower
    // than a team hitting objectives and consistency, since those are
    // weighted higher by default - this is the whole point of Section 40.
    const stepsArmsRaceTeam = blendedTeamScore(
      { teamObjectivesScore: 0, individualConsistencyScore: 0, rawActivityScore: 1, challengesAndEventsScore: 0, achievementsScore: 0 },
      DEFAULT_SCORING_CONFIG
    );
    const consistentTeamTeam = blendedTeamScore(
      { teamObjectivesScore: 1, individualConsistencyScore: 1, rawActivityScore: 0, challengesAndEventsScore: 0, achievementsScore: 0 },
      DEFAULT_SCORING_CONFIG
    );
    expect(consistentTeamTeam).toBeGreaterThan(stepsArmsRaceTeam);
  });
});
