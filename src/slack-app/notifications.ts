/**
 * Notification message builders (PRD Section 17). Kept as pure functions
 * that return message text, so the scheduler that actually calls
 * `client.chat.postMessage` can be swapped or tested independently, and
 * so admins can eventually customize copy/frequency without touching
 * this logic (Section 17: "Administrators should be able to disable or
 * customize notification frequency").
 */

export function morningNudge(teamName: string, stepsRemaining: number): string {
  return `☀️ Good morning, Team ${teamName}!\nYou're only ${stepsRemaining.toLocaleString()} steps away from today's team goal.`;
}

export function middayStanding(teamName: string, rank: number, pointsBehindLeader: number): string {
  if (rank === 1) {
    return `🔥 Team ${teamName} is currently in 1st place. Keep it up!`;
  }
  return `🔥 Team ${teamName} is currently in ${rank}${ordinalSuffix(rank)} place.\nThe leader is only ${pointsBehindLeader} points ahead!`;
}

export function personalAchievement(userDisplayName: string, streakDays: number): string {
  return `🏆 YOU DID IT!\n${userDisplayName} completed their step goal for the ${streakDays}${ordinalSuffix(
    streakDays
  )} day in a row.`;
}

export function teamAchievement(teamName: string, milestoneName: string, vpAwarded: number): string {
  return `🚀 TEAM ${teamName.toUpperCase()} REACHED ${milestoneName.toUpperCase()}!\n+${vpAwarded} Victory Points`;
}

export function competitionAlert(overtakingTeamName: string, overtakenTeamName: string): string {
  return `⚔️ Team ${overtakingTeamName} just passed Team ${overtakenTeamName}!\nCan you catch them?`;
}

export function comebackEvent(lastPlaceTeamName: string, targetPoints: number, bonusVp: number): string {
  return `🚨 COMEBACK EVENT\nTeam ${lastPlaceTeamName} is currently in last place.\nComplete ${targetPoints.toLocaleString()} combined activity points today and earn +${bonusVp} VP.`;
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}
