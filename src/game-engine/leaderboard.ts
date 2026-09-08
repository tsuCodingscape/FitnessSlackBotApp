import type { LeaderboardEntry } from "../shared/types.js";

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
