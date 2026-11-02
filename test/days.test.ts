import { describe, it, expect } from "vitest";
import { dayKeyInTimezone, startOfDayInTimezone, nextDayStartInTimezone, isValidTimeZone } from "../src/game-engine/days.js";

describe("dayKeyInTimezone", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // 6pm PDT on Sep 1 is already Sep 2 in UTC.
    const evening = new Date("2026-09-02T01:00:00Z");
    expect(dayKeyInTimezone(evening, "America/Los_Angeles")).toBe("2026-09-01");
    expect(dayKeyInTimezone(evening, "UTC")).toBe("2026-09-02");
  });

  it("handles timezones ahead of UTC", () => {
    expect(dayKeyInTimezone(new Date("2026-09-01T20:00:00Z"), "Asia/Tokyo")).toBe("2026-09-02");
  });
});

describe("startOfDayInTimezone", () => {
  it("returns local midnight as a UTC instant", () => {
    const evening = new Date("2026-09-02T01:00:00Z");
    expect(startOfDayInTimezone(evening, "America/Los_Angeles").toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(startOfDayInTimezone(evening, "Asia/Tokyo").toISOString()).toBe("2026-09-01T15:00:00.000Z");
  });

  it("uses the right offset on DST transition days", () => {
    // US DST ends 2026-11-01: midnight that day is still PDT (UTC-7).
    expect(startOfDayInTimezone(new Date("2026-11-01T20:00:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-11-01T07:00:00.000Z"
    );
    // ...and the next day's midnight is PST (UTC-8).
    expect(startOfDayInTimezone(new Date("2026-11-02T20:00:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-11-02T08:00:00.000Z"
    );
  });
});

describe("nextDayStartInTimezone", () => {
  it("steps a normal day by 24h", () => {
    expect(nextDayStartInTimezone(new Date("2026-09-01T07:00:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-09-02T07:00:00.000Z"
    );
  });

  it("handles the 25h day when DST ends and the 23h day when it starts", () => {
    expect(nextDayStartInTimezone(new Date("2026-11-01T07:00:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-11-02T08:00:00.000Z"
    );
    expect(nextDayStartInTimezone(new Date("2026-03-08T08:00:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-03-09T07:00:00.000Z"
    );
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects anything else", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Pacific Time")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
