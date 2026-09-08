import { describe, it, expect } from "vitest";
import { buildLeaderboard, buildMostImprovedLeaderboard } from "../src/game-engine/leaderboard.js";

describe("buildLeaderboard", () => {
  it("ranks by VP descending, then movement points as a tiebreak", () => {
    const result = buildLeaderboard([
      { id: "a", name: "Phoenix", vp: 40, movementPoints: 900 },
      { id: "b", name: "Galaxy", vp: 42, movementPoints: 800 },
      { id: "c", name: "Rockets", vp: 40, movementPoints: 950 },
    ]);
    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(result[0].rank).toBe(1);
  });

  it("gives tied entities the same dense rank", () => {
    const result = buildLeaderboard([
      { id: "a", name: "A", vp: 10, movementPoints: 100 },
      { id: "b", name: "B", vp: 10, movementPoints: 100 },
      { id: "c", name: "C", vp: 5, movementPoints: 50 },
    ]);
    expect(result.find((r) => r.id === "a")?.rank).toBe(1);
    expect(result.find((r) => r.id === "b")?.rank).toBe(1);
    expect(result.find((r) => r.id === "c")?.rank).toBe(2);
  });
});

describe("buildMostImprovedLeaderboard", () => {
  it("ranks by the delta between two windows, not absolute VP", () => {
    const result = buildMostImprovedLeaderboard([
      { id: "a", name: "A", previousWindowVp: 10, currentWindowVp: 15 }, // +5
      { id: "b", name: "B", previousWindowVp: 40, currentWindowVp: 42 }, // +2, but higher absolute VP
    ]);
    expect(result[0].id).toBe("a");
  });
});
