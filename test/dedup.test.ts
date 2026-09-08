import { describe, it, expect } from "vitest";
import { deduplicateActivities } from "../src/providers/dedup.js";
import type { NormalizedActivity } from "../src/shared/types.js";

function activity(overrides: Partial<NormalizedActivity>): NormalizedActivity {
  return {
    userId: "user-1",
    provider: "mock",
    activityType: "steps",
    startTime: new Date("2026-06-01T00:00:00Z"),
    endTime: new Date("2026-06-01T23:59:00Z"),
    sourceId: "src-1",
    ...overrides,
  };
}

describe("deduplicateActivities", () => {
  it("drops exact duplicates from the same provider+sourceId", () => {
    const result = deduplicateActivities([
      activity({ provider: "apple_health", sourceId: "a1", steps: 8000 }),
      activity({ provider: "apple_health", sourceId: "a1", steps: 8000 }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("prefers the higher-priority provider when two providers report overlapping activity", () => {
    const result = deduplicateActivities([
      activity({ provider: "garmin", sourceId: "g1", steps: 8000 }),
      activity({ provider: "apple_health", sourceId: "ah1", steps: 8200 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("apple_health");
  });

  it("keeps non-overlapping activity from multiple providers for the same user", () => {
    const result = deduplicateActivities([
      activity({
        provider: "garmin",
        sourceId: "g1",
        steps: 8000,
        startTime: new Date("2026-06-01T00:00:00Z"),
        endTime: new Date("2026-06-01T23:59:00Z"),
      }),
      activity({
        provider: "fitbit",
        sourceId: "f1",
        steps: 4000,
        startTime: new Date("2026-06-02T00:00:00Z"),
        endTime: new Date("2026-06-02T23:59:00Z"),
      }),
    ]);
    expect(result).toHaveLength(2);
  });
});
