import type { PrismaClient } from "@prisma/client";
import { getProvider } from "./registry.js";
import { deduplicateActivities } from "./dedup.js";
import { isValidNormalizedActivity } from "./normalize.js";
import { applyAntiCheatPolicy, type AntiCheatMode } from "./antiCheat.js";
import type { NormalizedActivity } from "../shared/types.js";

/**
 * The end-to-end ingestion pipeline (PRD Section 31-37):
 *
 *   provider.fetchActivities()
 *     -> validate
 *     -> deduplicate across the user's connected providers
 *     -> anti-cheat screening
 *     -> upsert into Activity (DB-level @@unique([provider, sourceId]) is
 *        the final backstop against double-counting on repeated syncs)
 *
 * Called by the sync scheduler (every few minutes for real providers, or
 * on demand by the demo script) for one user across all of their connected
 * device providers at once, since de-dup has to happen across providers,
 * not per-provider.
 */
export async function ingestActivityForUser(
  prisma: PrismaClient,
  params: {
    userId: string;
    challengeId: string;
    since: Date;
    until: Date;
    antiCheatMode: AntiCheatMode;
  }
): Promise<{ inserted: number; flagged: number; rejected: number; deduped: number }> {
  const connections = await prisma.deviceConnection.findMany({
    where: { userId: params.userId, status: "connected" },
  });

  const allActivities: NormalizedActivity[] = [];
  for (const connection of connections) {
    const provider = getProvider(connection.provider as NormalizedActivity["provider"]);
    const fetched = await provider.fetchActivities({
      userId: params.userId,
      externalUserId: connection.externalUserId ?? connection.userId,
      since: params.since,
      until: params.until,
    });
    allActivities.push(...fetched.filter(isValidNormalizedActivity));
  }

  const deduped = deduplicateActivities(allActivities);
  const { accepted, flagged, rejected } = applyAntiCheatPolicy(deduped, params.antiCheatMode);

  let inserted = 0;
  for (const batch of [
    { activities: accepted, flagged: false },
    { activities: flagged, flagged: true },
  ]) {
    for (const activity of batch.activities) {
      await prisma.activity.upsert({
        where: { provider_sourceId: { provider: activity.provider, sourceId: activity.sourceId } },
        create: {
          userId: activity.userId,
          challengeId: params.challengeId,
          provider: activity.provider,
          activityType: activity.activityType,
          startTime: activity.startTime,
          endTime: activity.endTime,
          steps: activity.steps,
          distanceMeters: activity.distanceMeters,
          durationMinutes: activity.durationMinutes,
          calories: activity.calories,
          sourceId: activity.sourceId,
          flagged: batch.flagged,
        },
        // A later sync for the same (provider, sourceId) updates the record
        // rather than creating a duplicate - e.g. a partial day re-synced
        // after more steps accrue.
        update: {
          steps: activity.steps,
          distanceMeters: activity.distanceMeters,
          durationMinutes: activity.durationMinutes,
          calories: activity.calories,
          endTime: activity.endTime,
          flagged: batch.flagged,
        },
      });
      inserted += 1;
    }
  }

  await prisma.deviceConnection.updateMany({
    where: { userId: params.userId },
    data: { lastSyncAt: new Date() },
  });

  return {
    inserted,
    flagged: flagged.length,
    rejected: rejected.length,
    deduped: allActivities.length - deduped.length,
  };
}
