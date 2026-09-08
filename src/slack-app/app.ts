import "dotenv/config";
import pkg from "@slack/bolt";
const { App, LogLevel } = pkg;
import { handleFitnessCommand } from "./commands/fitness.js";
import { buildHomeTabView } from "./blocks/homeTab.js";
import { getActiveChallenge, getUserBySlackId, getPersonalProgress, getTeamLeaderboard, getTeamBoardProgress } from "./queries.js";
import { prisma } from "./db.js";

/**
 * Socket Mode is used for local/dev so the bot works without a public
 * HTTPS endpoint (PRD's Slack-first architecture, Section 15-18). For
 * production, swap to HTTP mode behind a real endpoint and Slack's
 * standard OAuth redirect install flow (SLACK_CLIENT_ID/SECRET are
 * already read from env for that).
 */
const app = new pkg.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.INFO,
});

app.command("/fitness", handleFitnessCommand);

// App Home tab (PRD Section 16), refreshed whenever a user opens it.
app.event("app_home_opened", async ({ event, client }) => {
  const authResult = await client.auth.test();
  const teamId = authResult.team_id as string;
  const org = await prisma.organization.findUnique({ where: { slackTeamId: teamId } });
  if (!org) return;

  const challenge = await getActiveChallenge(org.id);
  if (!challenge) return;

  const user = await getUserBySlackId(org.id, event.user);
  const [teamLeaderboard, boardProgress] = await Promise.all([
    getTeamLeaderboard(challenge.id),
    getTeamBoardProgress(challenge.id),
  ]);

  let teamName: string | undefined;
  let teamRank: number | undefined;
  let teamVp: number | undefined;
  let teamPercentToNextChapter: number | undefined;
  let personalTodaySteps = 0;
  let personalStreakDays = 0;
  let personalVp = 0;
  let personalRank: number | undefined;

  if (user) {
    const membership = await prisma.teamMembership.findFirst({
      where: { userId: user.id, team: { challengeId: challenge.id } },
      include: { team: true },
    });
    if (membership) {
      teamName = membership.team.name;
      const teamEntry = teamLeaderboard.find((e) => e.id === membership.teamId);
      teamRank = teamEntry?.rank;
      teamVp = teamEntry?.vp;
      teamPercentToNextChapter = boardProgress.find(
        (p: { teamId: string; percentComplete: number }) => p.teamId === membership.teamId
      )?.percentComplete;
    }
    const progress = await getPersonalProgress(user.id, challenge.id);
    personalTodaySteps = progress.todaySteps;
    personalStreakDays = progress.streakDays;
    personalVp = progress.totalVp;
  }

  const currentChapter = challenge.chapters.find(
    (c: { order: number; name: string }) => c.order === (boardProgress[0]?.currentChapterOrder ?? 1)
  );

  await client.views.publish({
    user_id: event.user,
    view: buildHomeTabView({
      challengeName: challenge.name,
      themeEmoji: challenge.theme?.boardEmojis ? (challenge.theme.boardEmojis as string[])[0] ?? "🏁" : "🏁",
      currentChapterName: currentChapter?.name ?? challenge.chapters[0]?.name ?? "Getting started",
      daysRemaining: Math.max(0, Math.ceil((challenge.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      personalTodaySteps,
      personalDailyGoalSteps: (challenge.scoringConfig as { conversion: { dailyGoalSteps: number } }).conversion.dailyGoalSteps,
      personalStreakDays,
      personalVp,
      personalRank,
      teamName,
      teamRank,
      teamVp,
      teamPercentToNextChapter,
    }),
  });
});

// Quick-action buttons on the Home tab (PRD Section 16 "Quick Actions").
app.action("view_leaderboard", async ({ ack, body, client }) => {
  await ack();
  // In production this opens a modal with the live leaderboard; for the
  // MVP scaffold we just log the interaction so the wiring is provable.
  console.log(`view_leaderboard clicked by ${(body as { user: { id: string } }).user.id}`);
});
app.action("view_team", async ({ ack }) => ack());
app.action("connect_device", async ({ ack }) => ack());
app.action("invite_coworker", async ({ ack }) => ack());

async function main() {
  await app.start();
  console.log("⚡️ Team Sprint Slack app is running (Socket Mode)");
}

main().catch((err) => {
  console.error("Failed to start Slack app:", err);
  process.exit(1);
});
