import { describe, it, expect } from "vitest";
import { evaluateUnlockedAchievements, type AchievementFacts } from "../src/game-engine/achievements.js";

const baseFacts: AchievementFacts = {
  totalActivitiesLogged: 0,
  currentStreakDays: 0,
  totalDistanceMiles: 0,
  totalExerciseMinutes: 0,
  chaptersWonFirst: 0,
  helpedTeamReachDailyGoalCount: 0,
  movedTeamFromLastToFirst: false,
};

describe("evaluateUnlockedAchievements", () => {
  it("unlocks nothing for a brand new participant with no activity", () => {
    expect(evaluateUnlockedAchievements(baseFacts)).toHaveLength(0);
  });

  it("unlocks first_steps as soon as one activity is logged", () => {
    const unlocked = evaluateUnlockedAchievements({ ...baseFacts, totalActivitiesLogged: 1 });
    expect(unlocked.map((a) => a.key)).toContain("first_steps");
  });

  it("unlocks multiple achievements at once when several conditions are met", () => {
    const unlocked = evaluateUnlockedAchievements({
      ...baseFacts,
      totalActivitiesLogged: 20,
      currentStreakDays: 7,
      totalDistanceMiles: 55,
    });
    const keys = unlocked.map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["first_steps", "on_fire", "marathon"]));
  });
});
