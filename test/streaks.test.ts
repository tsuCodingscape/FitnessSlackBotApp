import { describe, it, expect } from "vitest";
import { currentStreak, streakMilestonesReached, streakRuns } from "../src/game-engine/streaks.js";

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
  it("doesn't reset the streak when today has no data yet", () => {
    const map = { "2026-08-31": true, "2026-09-01": true };
    expect(currentStreak(map, "2026-09-02")).toBe(2);
  });

  it("doesn't reset the streak when today's goal isn't met yet", () => {
    const map = { "2026-08-31": true, "2026-09-01": true, "2026-09-02": false };
    expect(currentStreak(map, "2026-09-02")).toBe(2);
  });

  it("ends the streak at a gap before today", () => {
    const map = { "2026-08-29": true, "2026-08-31": true, "2026-09-01": true };
    expect(currentStreak(map, "2026-09-02")).toBe(2);
  });

  it("is zero when yesterday was missed", () => {
    const map = { "2026-08-31": true, "2026-09-01": false };
    expect(currentStreak(map, "2026-09-02")).toBe(0);
  });
});

describe("streakMilestonesReached", () => {
  it("counts how many N-day milestones a streak has crossed", () => {
    expect(streakMilestonesReached(9, 3)).toBe(3);
    expect(streakMilestonesReached(8, 3)).toBe(2);
    expect(streakMilestonesReached(2, 3)).toBe(0);
  });
});

describe("streakRuns", () => {
  it("returns every run of consecutive met days, not just the latest", () => {
    const map = {
      "2026-09-01": true,
      "2026-09-02": true,
      "2026-09-03": true,
      "2026-09-04": true,
      "2026-09-05": false,
      "2026-09-06": true,
      // 09-07 has no data
      "2026-09-08": true,
      "2026-09-09": true,
    };
    expect(streakRuns(map)).toEqual([4, 1, 2]);
  });

  it("joins runs across month boundaries regardless of key order", () => {
    expect(streakRuns({ "2026-10-01": true, "2026-09-30": true, "2026-09-29": true })).toEqual([3]);
  });

  it("is empty when no day met the goal", () => {
    expect(streakRuns({ "2026-09-01": false })).toEqual([]);
  });
});
