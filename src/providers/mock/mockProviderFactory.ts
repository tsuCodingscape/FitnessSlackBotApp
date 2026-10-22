import type { ActivityProvider } from "../types.js";
import type { NormalizedActivity, ProviderKey } from "../../shared/types.js";
import { seededRandom, randomInt } from "./random.js";
import { dayKeyInTimezone, nextDayStartInTimezone, startOfDayInTimezone } from "../../game-engine/days.js";

/**
 * Every mock provider (Apple Health, Garmin, Fitbit, Google Health Connect)
 * shares this generator. In place of real OAuth + API calls, it produces
 * a plausible day-by-day activity pattern per user: a base "activity
 * level" derived from the user id (so the same demo user is consistently
 * more or less active run to run) plus daily noise and a small chance of
 * a rest day - close enough to real device data to exercise the whole
 * game engine (scoring, streaks, chapters, dedup) without needing a
 * companion mobile app or third-party developer credentials.
 *
 * Swapping this out for a real provider later means implementing
 * ActivityProvider against that provider's actual API and registering it
 * in `registry.ts` - the rest of the app (ingestion, scoring, Slack UI)
 * is unaffected because everything downstream only sees NormalizedActivity.
 */
export function createMockProvider(key: ProviderKey): ActivityProvider {
  return {
    key,
    requiredScopes(activityTypes) {
      // Mocks still model "minimum necessary scopes" so the admin-facing
      // permissions UI has something real to show even in demo mode.
      return activityTypes.map((t) => `mock:${t}`);
    },
    async fetchActivities({ userId, externalUserId, since, until, timeZone = "UTC" }) {
      const rand = seededRandom(`${key}:${userId}:${externalUserId}`);
      const baseActivityLevel = randomInt(rand, 4, 10); // 4-10, a rough "how active is this person" dial
      const activities: NormalizedActivity[] = [];

      // Walk local calendar days (not fixed 24h steps, which drift by an
      // hour across a DST change) so each record covers exactly one day in
      // the challenge's timezone.
      for (
        let dayStart = startOfDayInTimezone(since, timeZone);
        dayStart.getTime() < until.getTime();
        dayStart = nextDayStartInTimezone(dayStart, timeZone)
      ) {
        const dayKey = dayKeyInTimezone(dayStart, timeZone);
        const isRestDay = rand() < 0.12; // ~12% chance of a low-activity day, like real life
        const dayRand = seededRandom(`${key}:${userId}:${dayKey}`);

        const steps = isRestDay
          ? randomInt(dayRand, 500, 3000)
          : randomInt(dayRand, baseActivityLevel * 700, baseActivityLevel * 1400);
        const exerciseMinutes = isRestDay ? 0 : randomInt(dayRand, 0, baseActivityLevel * 6);
        const distanceMeters = Math.round(steps * 0.78); // ~0.78m average stride

        const dayEnd = new Date(nextDayStartInTimezone(dayStart, timeZone).getTime() - 1000);

        activities.push({
          userId,
          provider: key,
          activityType: "steps",
          startTime: dayStart,
          endTime: dayEnd,
          steps,
          sourceId: `${key}-steps-${userId}-${dayKey}`,
        });

        activities.push({
          userId,
          provider: key,
          activityType: "distance",
          startTime: dayStart,
          endTime: dayEnd,
          distanceMeters,
          sourceId: `${key}-distance-${userId}-${dayKey}`,
        });

        if (exerciseMinutes > 0) {
          activities.push({
            userId,
            provider: key,
            activityType: "exercise_minutes",
            startTime: dayStart,
            endTime: dayEnd,
            durationMinutes: exerciseMinutes,
            sourceId: `${key}-exercise-${userId}-${dayKey}`,
          });
        }
      }

      return activities;
    },
  };
}
