import type { NormalizedActivity } from "../shared/types.js";

export type AntiCheatMode = "strict" | "moderate" | "relaxed";

export interface AntiCheatFinding {
  activity: NormalizedActivity;
  reason: string;
}

/**
 * Suspicious-activity screening (PRD Section 37). Kept intentionally
 * simple and explainable - a few physically-implausible thresholds -
 * rather than an opaque ML model, since admins need to be able to
 * explain to an employee why an activity was flagged.
 */
const MAX_PLAUSIBLE_STEPS_PER_DAY = 60000; // elite ultramarathon territory; anything beyond is almost certainly bad data or manual entry error
const MAX_PLAUSIBLE_MINUTES_PER_DAY = 16 * 60; // > 16 hours of continuous "exercise" in a day
const MAX_PLAUSIBLE_METERS_PER_DAY = 160934; // 100 miles

export function findSuspiciousActivities(activities: NormalizedActivity[]): AntiCheatFinding[] {
  const findings: AntiCheatFinding[] = [];
  for (const activity of activities) {
    if (activity.activityType === "steps" && (activity.steps ?? 0) > MAX_PLAUSIBLE_STEPS_PER_DAY) {
      findings.push({ activity, reason: `Implausible step count: ${activity.steps} in one day` });
    }
    if (
      activity.activityType === "exercise_minutes" &&
      (activity.durationMinutes ?? 0) > MAX_PLAUSIBLE_MINUTES_PER_DAY
    ) {
      findings.push({ activity, reason: `Implausible exercise duration: ${activity.durationMinutes} minutes in one day` });
    }
    if (activity.activityType === "distance" && (activity.distanceMeters ?? 0) > MAX_PLAUSIBLE_METERS_PER_DAY) {
      findings.push({ activity, reason: `Implausible distance: ${activity.distanceMeters}m in one day` });
    }
    if (activity.provider === "manual" && (activity.steps ?? 0) > 0 && (activity.steps ?? 0) % 10000 === 0) {
      // Heuristic only, and deliberately weak: a suspiciously "round" manual
      // entry is a signal worth a second look, not proof of cheating.
      findings.push({ activity, reason: "Round-number manual entry flagged for review" });
    }
  }
  return findings;
}

/**
 * Applies the challenge's configured anti-cheat mode to a batch of
 * incoming activities, returning which should be persisted as-is,
 * which should be persisted but flagged for admin review, and which
 * should be rejected outright.
 */
export function applyAntiCheatPolicy(
  activities: NormalizedActivity[],
  mode: AntiCheatMode
): { accepted: NormalizedActivity[]; flagged: NormalizedActivity[]; rejected: NormalizedActivity[] } {
  const findings = findSuspiciousActivities(activities);
  const suspiciousSourceIds = new Set(findings.map((f) => f.activity.sourceId));

  const accepted: NormalizedActivity[] = [];
  const flagged: NormalizedActivity[] = [];
  const rejected: NormalizedActivity[] = [];

  for (const activity of activities) {
    if (!suspiciousSourceIds.has(activity.sourceId)) {
      accepted.push(activity);
      continue;
    }
    if (mode === "relaxed") accepted.push(activity);
    else if (mode === "moderate") flagged.push(activity);
    else rejected.push(activity);
  }

  return { accepted, flagged, rejected };
}
