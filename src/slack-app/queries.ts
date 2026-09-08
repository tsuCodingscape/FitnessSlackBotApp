import { prisma } from "./db.js";
import { buildLeaderboard, movementPointsForActivity, computeTeamProgress, currentStreak } from "../game-engine/index.js";
import type { ScoringConfig } from "../shared/types.js";

/** Find the single active challenge for an org (MVP: one running challenge at a time; Phase 3 adds concurrent challenges). */
export async function getActiveChallenge(organizationId: string) {
  return prisma.challenge.findFirst({
    where: { organizationId, status: "active" },
    include: { chapters: { orderBy: { order: "asc" } }, theme: true, teams: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserBySlackId(organizationId: string, slackUserId: string) {
  return prisma.user.findUnique({ where: { organizationId_slackUserId: { organizationId, slackUserId } } });
}

export async function getTeamLeaderboard(challengeId: string) {
  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;

  const teams = await prisma.team.findMany({ where: { challengeId }, include: { vpTransactions: true } });
  const activities = await prisma.activity.findMany({
    where: { challengeId, flagged: false },
    include: { user: { include: { teamMemberships: true } } },
  });

  const movementByTeam = new Map<string, number>();
  for (const activity of activities) {
    const membership = activity.user.teamMemberships.find(
      (m: { teamId: string }) => teams.some((t: { id: string }) => t.id === m.teamId)
    );
    if (!membership) continue;
    const points = movementPointsForActivity(activity, scoringConfig);
    movementByTeam.set(membership.teamId, (movementByTeam.get(membership.teamId) ?? 0) + points);
  }

  return buildLeaderboard(
    teams.map((team: { id: string; name: string; emoji: string; vpTransactions: { amount: number }[] }) => ({
      id: team.id,
      name: team.name,
      emoji: team.emoji,
      vp: team.vpTransactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0),
      movementPoints: movementByTeam.get(team.id) ?? 0,
    }))
  );
}

export async function getTeamBoardProgress(challengeId: string) {
  const challenge = await prisma.challenge.findUniqueOrThrow({
    where: { id: challengeId },
    include: { chapters: { orderBy: { order: "asc" } } },
  });
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;
  const teams = await prisma.team.findMany({ where: { challengeId } });
  const activities = await prisma.activity.findMany({
    where: { challengeId, flagged: false },
    include: { user: { include: { teamMemberships: true } } },
  });

  const movementByTeam = new Map<string, number>();
  for (const activity of activities) {
    const membership = activity.user.teamMemberships.find(
      (m: { teamId: string }) => teams.some((t: { id: string }) => t.id === m.teamId)
    );
    if (!membership) continue;
    const points = movementPointsForActivity(activity, scoringConfig);
    movementByTeam.set(membership.teamId, (movementByTeam.get(membership.teamId) ?? 0) + points);
  }

  return teams.map((team: { id: string }) =>
    computeTeamProgress(
      team.id,
      movementByTeam.get(team.id) ?? 0,
      challenge.chapters.map((c: { order: number; name: string; distanceGoal: number }) => ({
        order: c.order,
        name: c.name,
        distanceGoal: c.distanceGoal,
      }))
    )
  );
}

/** Personal "My Progress" stats for the Home tab / `/fitness profile` (PRD Section 16). */
export async function getPersonalProgress(userId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;

  const activities = await prisma.activity.findMany({ where: { userId, challengeId, flagged: false } });
  const vpTransactions = await prisma.vpTransaction.findMany({ where: { userId, challengeId } });

  const dailyGoalMet: Record<string, boolean> = {};
  const stepsByDay = new Map<string, number>();
  for (const a of activities) {
    if (a.activityType !== "steps" || a.steps == null) continue;
    const day = a.startTime.toISOString().slice(0, 10);
    stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + a.steps);
  }
  for (const [day, steps] of stepsByDay) {
    dailyGoalMet[day] = steps >= scoringConfig.conversion.dailyGoalSteps;
  }

  const today = new Date().toISOString().slice(0, 10);
  const totalMovementPoints = activities.reduce(
    (sum: number, a: Parameters<typeof movementPointsForActivity>[0]) => sum + movementPointsForActivity(a, scoringConfig),
    0
  );
  const totalVp = vpTransactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

  return {
    todaySteps: stepsByDay.get(today) ?? 0,
    totalMovementPoints,
    totalVp,
    streakDays: currentStreak(dailyGoalMet, today),
    dailyGoalSteps: scoringConfig.conversion.dailyGoalSteps,
  };
}
