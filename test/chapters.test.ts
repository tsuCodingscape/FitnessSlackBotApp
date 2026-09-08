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
  it("only ranks teams that have actually reached the chapter goal, fastest first", () => {
    const ranking = rankTeamsByChapterArrival(
      [
        { teamId: "phoenix", cumulativeMovementPoints: 1200 },
        { teamId: "galaxy", cumulativeMovementPoints: 900 },
        { teamId: "rockets", cumulativeMovementPoints: 400 },
      ],
      1000
    );
    expect(ranking).toEqual(["phoenix"]);
  });
});
