import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from "@slack/bolt";
import { getActiveChallenge, getUserBySlackId, getTeamLeaderboard, getPersonalProgress } from "../queries.js";
import { formatLeaderboardBlocks } from "../blocks/leaderboard.js";
import { prisma } from "../db.js";

/**
 * `/fitness [subcommand]` (PRD Section 15). Slack requires an ack within
 * ~3 seconds, so every branch here does a small number of indexed lookups
 * and returns - nothing here should do a full-table scan or an external
 * API call inline.
 */
export async function handleFitnessCommand({
  command,
  ack,
  respond,
  client,
}: AllMiddlewareArgs & SlackCommandMiddlewareArgs) {
  await ack();

  const [subcommand] = command.text.trim().split(/\s+/);
  const organizationId = await resolveOrganizationId(command.team_id);
  if (!organizationId) {
    await respond("This workspace hasn't been set up yet - ask an admin to install Team Sprint's challenge first.");
    return;
  }

  const challenge = await getActiveChallenge(organizationId);
  if (!challenge) {
    await respond("There's no active challenge right now. Check back when the next one kicks off! 🏁");
    return;
  }

  switch (subcommand) {
    case "leaderboard": {
      const leaderboard = await getTeamLeaderboard(challenge.id);
      const vpLabel = (challenge.terminology as Record<string, string>)?.vp ?? "VP";
      await respond({ blocks: formatLeaderboardBlocks(`🏆 ${challenge.name} Leaderboard`, leaderboard, vpLabel) });
      return;
    }
    case "today":
    case "profile": {
      const user = await getUserBySlackId(organizationId, command.user_id);
      if (!user) {
        await respond("You haven't joined this challenge yet - click Join Challenge in the announcement to get started!");
        return;
      }
      const progress = await getPersonalProgress(user.id, challenge.id);
      await respond(
        `*Your progress in ${challenge.name}*\n` +
          `Today: ${progress.todaySteps.toLocaleString()} / ${progress.dailyGoalSteps.toLocaleString()} steps\n` +
          `Streak: ${progress.streakDays} day(s) 🔥\n` +
          `Total VP: ${progress.totalVp}`
      );
      return;
    }
    case "team": {
      const user = await getUserBySlackId(organizationId, command.user_id);
      const membership = user
        ? await prisma.teamMembership.findFirst({
            where: { userId: user.id, team: { challengeId: challenge.id } },
            include: { team: { include: { memberships: { include: { user: true } } } } },
          })
        : null;
      if (!membership) {
        await respond("You're not on a team for this challenge yet.");
        return;
      }
      const memberNames = membership.team.memberships.map(
        (m: { isCaptain: boolean; user: { displayName: string } }) =>
          `• ${m.user.displayName}${m.isCaptain ? " (captain)" : ""}`
      );
      await respond(`*${membership.team.emoji} ${membership.team.name}*\n${memberNames.join("\n")}`);
      return;
    }
    case "challenge": {
      await respond(
        `*${challenge.name}*\n${challenge.description ?? ""}\n` +
          `Runs ${challenge.startDate.toDateString()} → ${challenge.endDate.toDateString()}`
      );
      return;
    }
    case "help":
    default: {
      await respond(
        "*Team Sprint commands*\n" +
          "`/fitness today` - your progress today\n" +
          "`/fitness team` - your team roster\n" +
          "`/fitness leaderboard` - current standings\n" +
          "`/fitness challenge` - challenge details\n" +
          "`/fitness profile` - your personal stats\n" +
          "`/fitness help` - this message"
      );
      return;
    }
  }
}

async function resolveOrganizationId(slackTeamId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({ where: { slackTeamId } });
  return org?.id ?? null;
}
