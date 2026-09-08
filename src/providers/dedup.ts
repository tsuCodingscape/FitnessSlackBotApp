import type { NormalizedActivity } from "../shared/types.js";

/**
 * De-duplicate activity across multiple connected sources (PRD Section 33).
 * Two layers of protection:
 *
 *  1. Exact de-dup: same (provider, sourceId) pair - the DB's
 *     `@@unique([provider, sourceId])` constraint on Activity is the
 *     final backstop for this; this function catches it earlier, in-batch.
 *  2. Overlap de-dup: different providers reporting overlapping time
 *     windows of the *same* activity type for the same user (e.g. Apple
 *     Watch syncs a workout to Apple Health, and the user also has Garmin
 *     connected and it reports the same workout). We resolve this with a
 *     provider-priority order: whichever provider is considered more
 *     authoritative for that activity type wins, and the overlapping
 *     record from the lower-priority provider is dropped.
 */

// Higher priority = trusted over lower priority when time windows overlap for the same user+activityType.
const DEFAULT_PROVIDER_PRIORITY: Record<string, number> = {
  apple_health: 100, // typically the aggregator of Apple Watch + other apps
  google_health_connect: 90,
  garmin: 80,
  fitbit: 70,
  samsung_health: 60,
  oura: 50,
  manual: 10,
  mock: 5,
};

function overlaps(a: NormalizedActivity, b: NormalizedActivity): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function deduplicateActivities(
  activities: NormalizedActivity[],
  priority: Record<string, number> = DEFAULT_PROVIDER_PRIORITY
): NormalizedActivity[] {
  // Exact de-dup first (same provider + sourceId).
  const seenKeys = new Set<string>();
  const exactDeduped: NormalizedActivity[] = [];
  for (const activity of activities) {
    const key = `${activity.provider}:${activity.sourceId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    exactDeduped.push(activity);
  }

  // Overlap de-dup, grouped by user + activityType.
  const groups = new Map<string, NormalizedActivity[]>();
  for (const activity of exactDeduped) {
    const groupKey = `${activity.userId}:${activity.activityType}`;
    const group = groups.get(groupKey) ?? [];
    group.push(activity);
    groups.set(groupKey, group);
  }

  const result: NormalizedActivity[] = [];
  for (const group of groups.values()) {
    // Highest-priority provider's records always survive; lower-priority
    // records are dropped only if they overlap a surviving record.
    const sorted = [...group].sort(
      (a, b) => (priority[b.provider] ?? 0) - (priority[a.provider] ?? 0)
    );
    const kept: NormalizedActivity[] = [];
    for (const candidate of sorted) {
      const overlapsKept = kept.some((k) => overlaps(k, candidate));
      if (!overlapsKept) kept.push(candidate);
    }
    result.push(...kept);
  }

  return result;
}
