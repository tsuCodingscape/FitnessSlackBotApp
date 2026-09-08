import { Router } from "express";
import { prisma } from "../db.js";
import { buildLeaderboard, movementPointsForActivity } from "../../game-engine/index.js";
import type { ScoringConfig } from "../../shared/types.js";

export const leaderboardRouter = Router();

/**
 * Team leaderboard for a challenge (PRD Section 19). Respects the
 * challenge's visibilityMode (Section 36): "anonymous" masks team/user
 * names with a stable per-entity alias instead of real names.
 */
leaderboardRouter.get("/:challengeId/teams", async (req, res) => {
  const challenge = await prisma.challenge.findUnique({ where: { id: req.params.challengeId } });
  if (!challenge) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;

  const teams = await prisma.team.findMany({
    where: { challengeId: challenge.id },
    include: { vpTransactions: true },
  });

  const activities = await prisma.activity.findMany({
    where: { challengeId: challenge.id, flagged: false },
    include: { user: { include: { teamMemberships: true } } },
  });

  const movementByTeam = new Map<string, number>();
  for (const activity of activities) {
    const membership = activity.user.teamMemberships.find(
      (m: { teamId: string }) => m.teamId && teams.some((t: { id: string }) => t.id === m.teamId)
    );
    if (!membership) continue;
    const points = movementPointsForActivity(activity, scoringConfig);
    movementByTeam.set(membership.teamId, (movementByTeam.get(membership.teamId) ?? 0) + points);
  }

  const rankable = teams.map((team: { id: string; name: string; emoji: string; vpTransactions: { amount: number }[] }, i: number) => ({
    id: team.id,
    name: challenge.visibilityMode === "anonymous" ? `Team ${String.fromCharCode(65 + i)}` : team.name,
    emoji: challenge.visibilityMode === "anonymous" ? undefined : team.emoji,
    vp: team.vpTransactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0),
    movementPoints: movementByTeam.get(team.id) ?? 0,
  }));

  res.json(buildLeaderboard(rankable));
});

leaderboardRouter.get("/:challengeId/individuals", async (req, res) => {
  const challenge = await prisma.challenge.findUnique({ where: { id: req.params.challengeId } });
  if (!challenge) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (challenge.visibilityMode === "team_only" || challenge.visibilityMode === "private") {
    res.status(403).json({ error: `Individual leaderboard disabled for visibilityMode="${challenge.visibilityMode}"` });
    return;
  }
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;

  const users = await prisma.user.findMany({
    where: { activities: { some: { challengeId: challenge.id } } },
    include: {
      activities: { where: { challengeId: challenge.id, flagged: false } },
      vpTransactions: { where: { challengeId: challenge.id } },
    },
  });

  const rankable = users.map(
    (
      user: {
        id: string;
        displayName: string;
        avatarEmoji: string;
        vpTransactions: { amount: number }[];
        activities: Parameters<typeof movementPointsForActivity>[0][];
      },
      i: number
    ) => ({
      id: user.id,
      name: challenge.visibilityMode === "anonymous" ? `Participant ${i + 1}` : user.displayName,
      emoji: challenge.visibilityMode === "anonymous" ? undefined : user.avatarEmoji,
      vp: user.vpTransactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0),
      movementPoints: user.activities.reduce((sum: number, a) => sum + movementPointsForActivity(a, scoringConfig), 0),
    })
  );

  res.json(buildLeaderboard(rankable));
});
