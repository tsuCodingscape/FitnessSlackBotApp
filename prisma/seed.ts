import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SCORING_CONFIG } from "../src/shared/types.js";
import { ingestActivityForUser } from "../src/providers/ingest.js";
import { settleChallenge } from "../src/scripts/settleChallenge.js";
import { buildLeaderboard, movementPointsForActivity } from "../src/game-engine/index.js";

const prisma = new PrismaClient();

const DEMO_PROVIDERS = ["apple_health", "garmin", "fitbit", "google_health_connect"] as const;

const DEMO_USERS: Array<{ slackUserId: string; displayName: string; provider: (typeof DEMO_PROVIDERS)[number] }> = [
  { slackUserId: "U_ALEX", displayName: "Alex Rivera", provider: "apple_health" },
  { slackUserId: "U_JAMIE", displayName: "Jamie Chen", provider: "garmin" },
  { slackUserId: "U_TAYLOR", displayName: "Taylor Brooks", provider: "fitbit" },
  { slackUserId: "U_MORGAN", displayName: "Morgan Lee", provider: "google_health_connect" },
  { slackUserId: "U_CASEY", displayName: "Casey Kim", provider: "apple_health" },
  { slackUserId: "U_SAM", displayName: "Sam Patel", provider: "garmin" },
];

async function main() {
  console.log("🌱 Seeding Team Sprint demo data...\n");

  await prisma.$transaction([
    prisma.vpTransaction.deleteMany(),
    prisma.userAchievement.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.deviceConnection.deleteMany(),
    prisma.teamMembership.deleteMany(),
    prisma.challengeEvent.deleteMany(),
    prisma.prize.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.team.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.challenge.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  const org = await prisma.organization.create({
    data: { name: "Codingscape", slackTeamId: "T_DEMO_CODINGSCAPE", slackDomain: "codingscape" },
  });

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - 20); // pretend we're 20 days into a 28-day challenge
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 28);

  const challenge = await prisma.challenge.create({
    data: {
      organizationId: org.id,
      name: "Summer Sprint",
      description: "4 weeks. 2 teams. One champion.",
      status: "active",
      startDate,
      endDate,
      competitionMode: "team",
      difficulty: "standard",
      visibilityMode: "public",
      antiCheatMode: "moderate",
      scoringConfig: DEFAULT_SCORING_CONFIG,
      terminology: { vp: "Victory Points", safehouse: "Safehouse", chapter: "Chapter" },
      theme: {
        create: {
          key: "summer",
          displayName: "Summer Beach Sprint",
          primaryColor: "#0ea5e9",
          accentColor: "#f97316",
          boardEmojis: ["🏖️", "🌴", "🏄", "🏔️", "🏆"],
        },
      },
      chapters: {
        create: [
          { order: 1, name: "Beach Dash", startDate, endDate: addDays(startDate, 7), distanceGoal: 500 },
          { order: 2, name: "Mountain Climb", startDate: addDays(startDate, 7), endDate: addDays(startDate, 14), distanceGoal: 1100 },
          { order: 3, name: "City Race", startDate: addDays(startDate, 14), endDate: addDays(startDate, 21), distanceGoal: 1800 },
          { order: 4, name: "Championship", startDate: addDays(startDate, 21), endDate, distanceGoal: 2600 },
        ],
      },
    },
  });

  const teamPhoenix = await prisma.team.create({
    data: { challengeId: challenge.id, name: "Phoenix", emoji: "🔥", colorHex: "#ef4444" },
  });
  const teamGalaxy = await prisma.team.create({
    data: { challengeId: challenge.id, name: "Galaxy", emoji: "🌌", colorHex: "#8b5cf6" },
  });
  const teams = [teamPhoenix, teamGalaxy];

  await prisma.prize.createMany({
    data: [
      { challengeId: challenge.id, category: "overall_1st", scope: "team", kind: "custom", description: "Team dinner", value: "$500" },
      { challengeId: challenge.id, category: "overall_2nd", scope: "team", kind: "custom", description: "Team happy hour", value: "$250" },
      { challengeId: challenge.id, category: "most_improved", scope: "individual", kind: "gift_card", description: "Gift card", value: "$50" },
      { challengeId: challenge.id, category: "longest_streak", scope: "individual", kind: "company_reward", description: "Company swag" },
    ],
  });

  for (const [i, demoUser] of DEMO_USERS.entries()) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        slackUserId: demoUser.slackUserId,
        displayName: demoUser.displayName,
        avatarEmoji: ["🏃", "🚴", "🏊", "🧗", "🤸", "⛹️"][i % 6],
      },
    });

    await prisma.teamMembership.create({
      data: { teamId: teams[i % teams.length].id, userId: user.id, isCaptain: i < teams.length },
    });

    await prisma.deviceConnection.create({
      data: {
        userId: user.id,
        provider: demoUser.provider,
        status: "connected",
        scopes: ["steps", "distance", "exercise_minutes"],
        externalUserId: `mock-${user.id}`,
      },
    });

    const result = await ingestActivityForUser(prisma, {
      userId: user.id,
      challengeId: challenge.id,
      since: startDate,
      until: new Date(),
      antiCheatMode: "moderate",
    });
    console.log(
      `  synced ${demoUser.displayName} (${demoUser.provider}): ${result.inserted} activities, ${result.deduped} deduped, ${result.flagged} flagged`
    );
  }

  console.log("\n⚙️  Settling Victory Points from activity...\n");
  await settleChallenge(prisma, challenge.id);

  // --- Print the resulting leaderboard, proving the pipeline works end to end ---
  const scoringConfig = DEFAULT_SCORING_CONFIG;
  const teamRows = await prisma.team.findMany({ where: { challengeId: challenge.id }, include: { vpTransactions: true } });
  const activities = await prisma.activity.findMany({
    where: { challengeId: challenge.id, flagged: false },
    include: { user: { include: { teamMemberships: true } } },
  });
  const movementByTeam = new Map<string, number>();
  for (const activity of activities) {
    const membership = activity.user.teamMemberships.find(
      (m: { teamId: string }) => teamRows.some((t: { id: string }) => t.id === m.teamId)
    );
    if (!membership) continue;
    movementByTeam.set(
      membership.teamId,
      (movementByTeam.get(membership.teamId) ?? 0) + movementPointsForActivity(activity, scoringConfig)
    );
  }
  const leaderboard = buildLeaderboard(
    teamRows.map((t: { id: string; name: string; emoji: string; vpTransactions: { amount: number }[] }) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      vp: t.vpTransactions.reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0),
      movementPoints: movementByTeam.get(t.id) ?? 0,
    }))
  );

  console.log("🏆 Summer Sprint — Team Leaderboard\n");
  for (const entry of leaderboard) {
    console.log(`  #${entry.rank}  ${entry.emoji} ${entry.name} — ${entry.vp} VP (${entry.movementPoints} movement pts)`);
  }
  console.log("\n✅ Seed complete. Organization:", org.id, "| Challenge:", challenge.id);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
