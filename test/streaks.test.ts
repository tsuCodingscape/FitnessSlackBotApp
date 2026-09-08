import { describe, it, expect } from "vitest";
import { currentStreak, streakMilestonesReached } from "../src/game-engine/streaks.js";

describe("currentStreak", () => {
  it("counts consecutive met days walking back from today", () => {
    const map = {
      "2026-08-30": true,
      "2026-08-31": true,
      "2026-09-01": true,
      "2026-09-02": true,
    };
    expect(currentStreak(map, "2026-09-02")).toBe(4);
  });

  it("stops counting at an explicit miss", () => {
    const map = {
      "2026-08-30": true,
      "2026-08-31": false,
      "2026-09-01": true,
      "2026-09-02": true,
    };
    expect(currentStreak(map, "2026-09-02")).toBe(2);
  });

  it("treats an absent day as the end of the streak (not a break signal, just no data yet)", () => {
    const map = { "2026-09-01": true, "2026-09-02": true };
    expect(currentStreak(map, "2026-09-02")).toBe(2);
  });
});

describe("streakMilestonesReached", () => {
  it("counts how many N-day milestones a streak has crossed", () => {
    expect(streakMilestonesReached(9, 3)).toBe(3);
    expect(streakMilestonesReached(8, 3)).toBe(2);
    expect(streakMilestonesReached(2, 3)).toBe(0);
  });
});
