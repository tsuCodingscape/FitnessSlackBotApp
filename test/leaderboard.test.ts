import { describe, it, expect } from "vitest";
import { buildLeaderboard, buildMostImprovedLeaderboard } from "../src/game-engine/leaderboard.js";
import { teamsThatWentFromLastToFirst } from "../src/game-engine/leaderboard.js";

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

describe("teamsThatWentFromLastToFirst", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 8, n));

  it("detects a team that was alone in last and later alone in first", () => {
    const result = teamsThatWentFromLastToFirst([
      { teamId: "phoenix", events: [{ at: day(1), points: 100 }, { at: day(2), points: 10 }] },
      { teamId: "galaxy", events: [{ at: day(1), points: 50 }, { at: day(2), points: 200 }] },
    ]);
    expect([...result]).toEqual(["galaxy"]);
  });

  it("doesn't treat the all-zero start or ties as last/first place", () => {
    const result = teamsThatWentFromLastToFirst([
      { teamId: "a", events: [{ at: day(1), points: 100 }, { at: day(2), points: 100 }] },
      { teamId: "b", events: [{ at: day(1), points: 100 }, { at: day(2), points: 150 }] },
    ]);
    expect(result.size).toBe(0);
  });

  it("applies every event at the same instant before judging standings", () => {
    // If "a" were judged after only its own event, b would look last at day 1.
    const result = teamsThatWentFromLastToFirst([
      { teamId: "a", events: [{ at: day(1), points: 100 }, { at: day(3), points: 10 }] },
      { teamId: "b", events: [{ at: day(1), points: 150 }] },
    ]);
    expect(result.size).toBe(0);
  });

  it("counts a team with no activity yet as last", () => {
    const result = teamsThatWentFromLastToFirst([
      { teamId: "early", events: [{ at: day(1), points: 100 }] },
      { teamId: "late", events: [{ at: day(4), points: 500 }] },
    ]);
    expect([...result]).toEqual(["late"]);
  });
});
