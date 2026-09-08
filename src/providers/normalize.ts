import type { NormalizedActivity } from "../shared/types.js";

/**
 * Example of the normalization layer's job (PRD Section 32): different
 * providers report activity in wildly different shapes. Real provider
 * implementations each ship their own `toNormalized(...)` mapping raw
 * API responses into this shape; this file just documents the contract
 * and gives us one shared validity check used on every ingest path,
 * mock or real.
 */
export function isValidNormalizedActivity(a: NormalizedActivity): boolean {
  if (!a.userId || !a.provider || !a.activityType || !a.sourceId) return false;
  if (!(a.startTime instanceof Date) || !(a.endTime instanceof Date)) return false;
  if (a.endTime.getTime() < a.startTime.getTime()) return false;
  return true;
}
