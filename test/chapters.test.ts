import { describe, it, expect } from "vitest";
import { computeTeamProgress, rankTeamsByChapterArrival, type ChapterDef } from "../src/game-engine/chapters.js";

const chapters: ChapterDef[] = [
  { order: 1, name: "Beach Dash", distanceGoal: 500 },
  { order: 2, name: "Mountain Climb", distanceGoal: 1100 },
  { order: 3, name: "City Race", distanceGoal: 1800 },
];

describe("computeTeamProgress", () => {
  it("places a team in chapter 1 when under its goal", () => {
    const progress = computeTeamProgress("team-1", 200, chapters);
    expect(progress.currentChapterOrder).toBe(1);
    expect(progress.percentComplete).toBe(40);
  });

  it("moves a team into chapter 2 once chapter 1's goal is cleared", () => {
    const progress = computeTeamProgress("team-1", 700, chapters);
    expect(progress.currentChapterOrder).toBe(2);
    // 700 is 200 into the [500, 1100] span of 600 -> 33%
    expect(progress.percentComplete).toBe(33);
  });

  it("caps at 100% once the final chapter's goal is reached", () => {
    const progress = computeTeamProgress("team-1", 5000, chapters);
    expect(progress.percentComplete).toBe(100);
  });
});

describe("rankTeamsByChapterArrival", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 8, n));

  it("only ranks teams that have actually reached the chapter goal", () => {
    const ranking = rankTeamsByChapterArrival(
      [
        { teamId: "phoenix", events: [{ at: day(1), points: 1200 }] },
        { teamId: "galaxy", events: [{ at: day(1), points: 900 }] },
        { teamId: "rockets", events: [{ at: day(1), points: 400 }] },
      ],
      1000
    );
    expect(ranking).toEqual(["phoenix"]);
  });

  it("orders by when the goal was crossed, not by current totals", () => {
    const ranking = rankTeamsByChapterArrival(
      [
        // Galaxy arrives later (day 6) but ends up far ahead overall.
        { teamId: "galaxy", events: [{ at: day(6), points: 600 }, { at: day(7), points: 2000 }] },
        // Events are deliberately out of order; Phoenix crosses 500 on day 3.
        { teamId: "phoenix", events: [{ at: day(5), points: 100 }, { at: day(1), points: 300 }, { at: day(3), points: 250 }] },
      ],
      500
    );
    expect(ranking).toEqual(["phoenix", "galaxy"]);
  });

  it("breaks same-moment arrivals by the larger total at that moment", () => {
    const ranking = rankTeamsByChapterArrival(
      [
        { teamId: "a", events: [{ at: day(2), points: 520 }] },
        { teamId: "b", events: [{ at: day(2), points: 700 }] },
      ],
      500
    );
    expect(ranking).toEqual(["b", "a"]);
  });
});
