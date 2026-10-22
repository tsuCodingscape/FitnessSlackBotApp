import type { PrismaClient } from "@prisma/client";
import {
  movementPointsForActivity,
  metDailyGoal,
  streakRuns,
  streakMilestonesReached,
  teamsThatWentFromLastToFirst,
  rankTeamsByChapterArrival,
  evaluateUnlockedAchievements,
  dayKeyInTimezone,
  type AchievementFacts,
  type MovementPointsEvent,
} from "../game-engine/index.js";
import type { ScoringConfig } from "../shared/types.js";

/**
 * Orchestration layer that turns ingested Activity rows into VpTransaction
 * rows and unlocked achievements for a challenge. This is where the pure
 * game-engine functions (scoring.ts, chapters.ts, streaks.ts,
 * achievements.ts - all unit tested independently) meet persistence.
 *
 * In production this runs incrementally (e.g. once per day per challenge,
 * triggered by a scheduled job right after the activity sync window), so
 * it only settles "new" VP since the last run. For the MVP demo/seed we
 * run it once as a batch over the whole challenge history, which is why
 * it's idempotent-unsafe to call twice without clearing VpTransaction
 * first (documented in README).
 */
export async function settleChallenge(prisma: PrismaClient, challengeId: string) {
  const challenge = await prisma.challenge.findUniqueOrThrow({
    where: { id: challengeId },
    include: { chapters: { orderBy: { order: "asc" } }, teams: { include: { memberships: true } } },
  });
  const scoringConfig = challenge.scoringConfig as unknown as ScoringConfig;

  const activities = await prisma.activity.findMany({
    where: { challengeId, flagged: false },
    orderBy: { startTime: "asc" },
  });

  const activitiesByUser = new Map<string, typeof activities>();
  for (const activity of activities) {
    const list = activitiesByUser.get(activity.userId) ?? [];
    list.push(activity);
    activitiesByUser.set(activity.userId, list);
  }

  const teamIdByUserId = new Map<string, string>();
  for (const team of challenge.teams) {
    for (const membership of team.memberships) teamIdByUserId.set(membership.userId, team.id);
  }

  // --- 1. Team movement timeline, chapter-arrival order, comebacks -------
  // Points are credited when the activity ends, so arrival order reflects
  // which team actually crossed each chapter goal first. Team results are
  // worked out before the per-user pass since team achievements (Champion,
  // Comeback Kid) depend on them.
  const movementEventsByTeam = new Map<string, MovementPointsEvent[]>();
  for (const activity of activities) {
    const teamId = teamIdByUserId.get(activity.userId);
    if (!teamId) continue;
    const events = movementEventsByTeam.get(teamId) ?? [];
    events.push({ at: activity.endTime, points: movementPointsForActivity(activity, scoringConfig) });
    movementEventsByTeam.set(teamId, events);
  }
  const teamTimelines = [...movementEventsByTeam.entries()].map(([teamId, events]) => ({ teamId, events }));

  const arrivalOrderByChapter = challenge.chapters.map((chapter) => ({
    chapter,
    arrivalOrder: rankTeamsByChapterArrival(teamTimelines, chapter.distanceGoal),
  }));
  const chaptersWonFirstByTeam = new Map<string, number>();
  for (const { arrivalOrder } of arrivalOrderByChapter) {
    const winner = arrivalOrder[0];
    if (winner) chaptersWonFirstByTeam.set(winner, (chaptersWonFirstByTeam.get(winner) ?? 0) + 1);
  }
  const comebackTeams = teamsThatWentFromLastToFirst(
    // Teams with no activity at all still count as standing in last place.
    challenge.teams.map((team) => ({ teamId: team.id, events: movementEventsByTeam.get(team.id) ?? [] }))
  );

  // --- 2. Participation + per-user streak bonuses + achievements ---------
  for (const [userId, userActivities] of activitiesByUser) {
    const teamId = teamIdByUserId.get(userId);

    await prisma.vpTransaction.create({
      data: { userId, teamId, challengeId, amount: scoringConfig.vp.participationBonus, reason: "participation_bonus" },
    });

    const stepsByDay = new Map<string, number>();
    for (const a of userActivities) {
      if (a.activityType !== "steps" || a.steps == null) continue;
      const day = dayKeyInTimezone(a.startTime, challenge.timezone);
      stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + a.steps);
    }
    const dailyGoalMet: Record<string, boolean> = {};
    for (const [day, steps] of stepsByDay) dailyGoalMet[day] = metDailyGoal(steps, scoringConfig);

    // Settlement covers the whole challenge, so every streak counts - not
    // just the one still running on the last day.
    const runs = streakRuns(dailyGoalMet);
    const milestones = runs.reduce(
      (sum, run) => sum + streakMilestonesReached(run, scoringConfig.vp.streakMilestoneDays),
      0
    );
    if (milestones > 0) {
      await prisma.vpTransaction.create({
        data: {
          userId,
          teamId,
          challengeId,
          amount: milestones * scoringConfig.vp.streakBonus,
          reason: "streak",
          metadata: { streakRuns: runs },
        },
      });
    }

    const totalDistanceMiles =
      userActivities
        .filter((a: { activityType: string }) => a.activityType === "distance")
        .reduce((sum: number, a: { distanceMeters: number | null }) => sum + (a.distanceMeters ?? 0), 0) / 1609.34;
    const totalExerciseMinutes = userActivities
      .filter((a: { activityType: string }) => a.activityType === "exercise_minutes")
      .reduce((sum: number, a: { durationMinutes: number | null }) => sum + (a.durationMinutes ?? 0), 0);

    const facts: AchievementFacts = {
      totalActivitiesLogged: userActivities.length,
      longestStreakDays: Math.max(0, ...runs),
      totalDistanceMiles,
      totalExerciseMinutes,
      chaptersWonFirst: teamId ? chaptersWonFirstByTeam.get(teamId) ?? 0 : 0,
      helpedTeamReachDailyGoalCount: Object.values(dailyGoalMet).filter(Boolean).length,
      movedTeamFromLastToFirst: teamId ? comebackTeams.has(teamId) : false,
    };
    const unlocked = evaluateUnlockedAchievements(facts);
    for (const achievement of unlocked) {
      const achievementRow = await prisma.achievement.upsert({
        where: { key: achievement.key },
        create: { key: achievement.key, name: achievement.name, description: achievement.description, emoji: achievement.emoji },
        update: {},
      });
      await prisma.userAchievement.upsert({
        where: { userId_achievementId_challengeId: { userId, achievementId: achievementRow.id, challengeId } },
        create: { userId, achievementId: achievementRow.id, challengeId },
        update: {},
      });
    }

    // Team daily-goal VP: award once per user per day the goal was hit,
    // attributed to their team (PRD Section 10: "Reach daily team goal +1").
    const daysGoalMet = Object.values(dailyGoalMet).filter(Boolean).length;
    if (daysGoalMet > 0 && teamId) {
      await prisma.vpTransaction.create({
        data: { teamId, challengeId, amount: daysGoalMet * scoringConfig.vp.dailyTeamGoal, reason: "daily_team_goal" },
      });
    }
  }

  // --- 3. Chapter-arrival bonuses ----------------------------------------
  for (const { chapter, arrivalOrder } of arrivalOrderByChapter) {
    for (const [index, teamId] of arrivalOrder.entries()) {
      await prisma.vpTransaction.create({
        data: { teamId, challengeId, amount: scoringConfig.vp.chapterReached, reason: "chapter_reached", metadata: { chapter: chapter.name } },
      });
      if (index === 0) {
        await prisma.vpTransaction.create({
          data: {
            teamId,
            challengeId,
            amount: scoringConfig.vp.firstToDestination + scoringConfig.vp.chapterCompleteBonus,
            reason: "first_to_destination",
            metadata: { chapter: chapter.name },
          },
        });
      } else if (index === 1) {
        await prisma.vpTransaction.create({
          data: { teamId, challengeId, amount: scoringConfig.vp.secondToDestination, reason: "second_to_destination", metadata: { chapter: chapter.name } },
        });
      }
    }
  }
}
