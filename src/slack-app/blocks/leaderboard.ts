import type { KnownBlock } from "@slack/bolt";
import type { LeaderboardEntry } from "../../shared/types.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export function formatLeaderboardBlocks(title: string, entries: LeaderboardEntry[], vpLabel = "VP"): KnownBlock[] {
  const lines = entries.map((e) => {
    const medal = MEDALS[e.rank - 1] ?? `#${e.rank}`;
    const emoji = e.emoji ? `${e.emoji} ` : "";
    return `${medal} ${emoji}*${e.name}* — ${e.vp} ${vpLabel}`;
  });

  return [
    { type: "header", text: { type: "plain_text", text: title, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") || "_No standings yet._" } },
  ];
}
