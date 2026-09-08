import type { KnownBlock } from "@slack/bolt";

export interface HomeTabData {
  challengeName: string;
  themeEmoji: string;
  currentChapterName: string;
  daysRemaining: number;
  personalTodaySteps: number;
  personalDailyGoalSteps: number;
  personalStreakDays: number;
  personalVp: number;
  personalRank?: number;
  teamName?: string;
  teamRank?: number;
  teamVp?: number;
  teamPercentToNextChapter?: number;
}

/**
 * The App Home tab (PRD Section 16): "My Progress", "My Team", "Challenge",
 * and quick actions, all in one glanceable Block Kit view.
 */
export function buildHomeTabView(data: HomeTabData) {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${data.themeEmoji} ${data.challengeName}`, emoji: true },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `*${data.currentChapterName}* · ${data.daysRemaining} days remaining` }],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*My Progress*" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Today:*\n${data.personalTodaySteps.toLocaleString()} / ${data.personalDailyGoalSteps.toLocaleString()} steps` },
        { type: "mrkdwn", text: `*Streak:*\n${data.personalStreakDays} day${data.personalStreakDays === 1 ? "" : "s"} 🔥` },
        { type: "mrkdwn", text: `*My VP:*\n${data.personalVp}` },
        { type: "mrkdwn", text: `*My Rank:*\n${data.personalRank ? `#${data.personalRank}` : "—"}` },
      ],
    },
  ];

  if (data.teamName) {
    blocks.push(
      { type: "divider" },
      { type: "section", text: { type: "mrkdwn", text: "*My Team*" } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Team:*\n${data.teamName}` },
          { type: "mrkdwn", text: `*Team Rank:*\n${data.teamRank ? `#${data.teamRank}` : "—"}` },
          { type: "mrkdwn", text: `*Team VP:*\n${data.teamVp ?? 0}` },
          { type: "mrkdwn", text: `*Chapter Progress:*\n${data.teamPercentToNextChapter ?? 0}%` },
        ],
      }
    );
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "🏆 View Leaderboard" }, action_id: "view_leaderboard" },
        { type: "button", text: { type: "plain_text", text: "👥 View Team" }, action_id: "view_team" },
        { type: "button", text: { type: "plain_text", text: "🔗 Connect Device" }, action_id: "connect_device" },
        { type: "button", text: { type: "plain_text", text: "📨 Invite Coworker" }, action_id: "invite_coworker" },
      ],
    }
  );

  return {
    type: "home" as const,
    blocks,
  };
}
