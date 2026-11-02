import { describe, it, expect } from "vitest";
import { createMockProvider } from "../src/providers/mock/index.js";
import { dayKeyInTimezone, startOfDayInTimezone } from "../src/game-engine/days.js";

describe("mock provider daily records", () => {
  const tz = "America/Los_Angeles";
  const provider = createMockProvider("garmin");

  it("emits exactly one steps record per local day across a DST change, through today", async () => {
    const now = new Date("2026-11-10T20:00:00Z"); // window spans the Nov 1 DST change
    const since = startOfDayInTimezone(new Date("2026-10-21T20:00:00Z"), tz);
    const steps = (await provider.fetchActivities({ userId: "u1", externalUserId: "x", since, until: now, timeZone: tz }))
      .filter((a) => a.activityType === "steps");

    const keys = steps.map((a) => dayKeyInTimezone(a.startTime, tz));
    expect(new Set(keys).size).toBe(keys.length); // no day doubled up
    expect(keys[0]).toBe("2026-10-21");
    expect(keys.at(-1)).toBe("2026-11-10"); // today is present
    expect(keys).toHaveLength(21);
    // Each record ends inside the same local day it starts in.
    for (const a of steps) expect(dayKeyInTimezone(a.endTime, tz)).toBe(dayKeyInTimezone(a.startTime, tz));
  });
});
