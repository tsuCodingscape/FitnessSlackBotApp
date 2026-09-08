/**
 * Achievement definitions and their unlock conditions (PRD Section 38).
 * Kept as pure predicate functions over a small "facts" object so they're
 * easy to unit test and easy for an admin-facing builder to eventually
 * expose as toggleable rules.
 */

export interface AchievementFacts {
  totalActivitiesLogged: number;
  currentStreakDays: number;
  totalDistanceMiles: number;
  totalExerciseMinutes: number;
  chaptersWonFirst: number;
  helpedTeamReachDailyGoalCount: number;
  movedTeamFromLastToFirst: boolean;
}

export interface AchievementDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  isUnlocked: (facts: AchievementFacts) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_steps",
    name: "First Steps",
    emoji: "🚶",
    description: "Complete your first activity.",
    isUnlocked: (f) => f.totalActivitiesLogged >= 1,
  },
  {
    key: "on_fire",
    name: "On Fire",
    emoji: "🔥",
    description: "Maintain a 7-day streak.",
    isUnlocked: (f) => f.currentStreakDays >= 7,
  },
  {
    key: "marathon",
    name: "Marathon",
    emoji: "🏃",
    description: "Reach 50 miles.",
    isUnlocked: (f) => f.totalDistanceMiles >= 50,
  },
  {
    key: "power_player",
    name: "Power Player",
    emoji: "💪",
    description: "Complete 300 minutes of exercise.",
    isUnlocked: (f) => f.totalExerciseMinutes >= 300,
  },
  {
    key: "champion",
    name: "Champion",
    emoji: "🏆",
    description: "Finish first in a chapter.",
    isUnlocked: (f) => f.chaptersWonFirst >= 1,
  },
  {
    key: "team_player",
    name: "Team Player",
    emoji: "🤝",
    description: "Help your team reach a team goal.",
    isUnlocked: (f) => f.helpedTeamReachDailyGoalCount >= 1,
  },
  {
    key: "comeback_kid",
    name: "Comeback Kid",
    emoji: "🚀",
    description: "Help your team move from last place to first place.",
    isUnlocked: (f) => f.movedTeamFromLastToFirst,
  },
];

export function evaluateUnlockedAchievements(facts: AchievementFacts): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(facts));
}
