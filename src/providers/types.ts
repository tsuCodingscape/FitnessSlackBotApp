import type { NormalizedActivity, ProviderKey } from "../shared/types.js";

/**
 * Every fitness data source - real or mock - implements this interface
 * (PRD Section 31: "abstraction layer around fitness providers"). The game
 * engine and API never talk to Apple Health/Garmin/Fitbit/etc. directly;
 * they only ever see `NormalizedActivity[]` coming out of `fetchActivities`.
 *
 * A real implementation of this interface for, say, Fitbit would wrap
 * Fitbit's OAuth2 flow + Web API and map its response shape into
 * NormalizedActivity. Swapping mocks for real providers means writing a
 * new class here and registering it in `registry.ts` - nothing else in
 * the app needs to change.
 */
export interface ActivityProvider {
  readonly key: ProviderKey;

  /** Minimum scopes this provider needs for the given activity types (Section 35: request only what's needed). */
  requiredScopes(activityTypes: NormalizedActivity["activityType"][]): string[];

  /**
   * Fetch normalized activity for a user in a time window. Real providers
   * page through their API here; mock providers generate simulated data.
   */
  fetchActivities(params: {
    userId: string;
    externalUserId: string;
    since: Date;
    until: Date;
  }): Promise<NormalizedActivity[]>;
}
