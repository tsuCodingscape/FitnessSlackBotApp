import type { LeaderboardEntry } from "../shared/types.js";
import type { MovementPointsEvent } from "./chapters.js";

export interface RankableEntity {
  id: string;
  name: string;
  emoji?: string;
  vp: number;
  movementPoints: number;
}

/**
 * Rank teams/individuals by VP (primary) then movement points (tiebreak).
 * Ties in both are given equal rank (dense ranking), matching how a
 * displayed leaderboard should read to participants.
 */
export function buildLeaderboard(entities: RankableEntity[]): LeaderboardEntry[] {
  const sorted = [...entities].sort((a, b) => b.vp - a.vp || b.movementPoints - a.movementPoints);

  const result: LeaderboardEntry[] = [];
  let rank = 0;
  let lastVp: number | null = null;
  let lastMovement: number | null = null;

  for (const entity of sorted) {
    if (entity.vp !== lastVp || entity.movementPoints !== lastMovement) {
      rank += 1;
      lastVp = entity.vp;
      lastMovement = entity.movementPoints;
    }
    result.push({
      id: entity.id,
      name: entity.name,
      emoji: entity.emoji,
      vp: entity.vp,
      movementPoints: entity.movementPoints,
      rank,
    });
  }
  return result;
}

/** "Most improved" ranks by delta between two windows rather than absolute value (PRD Section 19). */
export function buildMostImprovedLeaderboard(
  entities: Array<{ id: string; name: string; emoji?: string; previousWindowVp: number; currentWindowVp: number }>
): Array<{ id: string; name: string; emoji?: string; delta: number; rank: number }> {
  const withDelta = entities.map((e) => ({ ...e, delta: e.currentWindowVp - e.previousWindowVp }));
  const sorted = withDelta.sort((a, b) => b.delta - a.delta);
  return sorted.map((e, i) => ({ id: e.id, name: e.name, emoji: e.emoji, delta: e.delta, rank: i + 1 }));
}

/**
 * Teams that were ever alone in last place and later alone in first place,
 * replaying movement points in time order ("Comeback Kid", PRD Section 38).
 * Standings are checked after each moment's points land; ties don't count
 * as last or first, so the all-zero start doesn't make everyone "last".
 */
export function teamsThatWentFromLastToFirst(
  teams: Array<{ teamId: string; events: MovementPointsEvent[] }>
): Set<string> {
  const result = new Set<string>();
  if (teams.length < 2) return result;

  const totals = new Map(teams.map((t) => [t.teamId, 0]));
  const timeline = teams
    .flatMap((t) => t.events.map((e) => ({ teamId: t.teamId, at: e.at.getTime(), points: e.points })))
    .sort((a, b) => a.at - b.at);

  const wasLast = new Set<string>();
  for (let i = 0; i < timeline.length; i++) {
    const event = timeline[i];
    totals.set(event.teamId, (totals.get(event.teamId) ?? 0) + event.points);
    // Only evaluate once every event at this instant has been applied.
    if (timeline[i + 1]?.at === event.at) continue;

    const values = [...totals.values()];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const leaders = [...totals].filter(([, v]) => v === max);
    const trailers = [...totals].filter(([, v]) => v === min);
    if (leaders.length === 1 && wasLast.has(leaders[0][0])) result.add(leaders[0][0]);
    if (trailers.length === 1) wasLast.add(trailers[0][0]);
  }
  return result;
}
