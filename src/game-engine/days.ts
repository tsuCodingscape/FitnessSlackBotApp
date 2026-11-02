/**
 * Calendar-day helpers. "Today", daily goals, and streaks are all about the
 * participant's local day, so day buckets use the challenge's IANA
 * timezone (Challenge.timezone) rather than UTC - otherwise a Pacific-time
 * user checking in at 6pm would already be on "tomorrow".
 */

/** The "YYYY-MM-DD" calendar date of `date` in `timeZone`. */
export function dayKeyInTimezone(date: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (e.g. -7h for PDT). */
function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant local midnight starts for the calendar day containing `date` in `timeZone`. */
export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  const [y, m, d] = dayKeyInTimezone(date, timeZone).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Apply the offset, then re-check it at the result in case midnight sits
  // on the other side of a DST transition from our first guess.
  let result = utcMidnight - timezoneOffsetMs(new Date(utcMidnight), timeZone);
  result = utcMidnight - timezoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

/**
 * The instant the next local calendar day starts after `dayStart` (itself a
 * local midnight). Days aren't always 24h - DST days are 23h or 25h - so
 * jump 26h (always lands inside the next day) and snap back to its midnight.
 */
export function nextDayStartInTimezone(dayStart: Date, timeZone: string): Date {
  return startOfDayInTimezone(new Date(dayStart.getTime() + 26 * 60 * 60 * 1000), timeZone);
}

/** Whether `timeZone` is an IANA zone name this runtime understands (e.g. "America/Los_Angeles"). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
