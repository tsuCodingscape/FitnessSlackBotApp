# Team Sprint

A Slack-native, gamified team fitness competition platform. Employees connect
Apple Health / Apple Watch, Garmin, Fitbit, Google Health Connect (and more)
to a company challenge; real-world activity moves their team across a
customizable game board, earns Victory Points, and unlocks achievements -
all playable from inside Slack. Admins fully customize the theme, scoring,
teams, prizes, and terminology per challenge.

This repo is an **MVP engineering scaffold** built from the attached PRD. It
is real, runnable code - not a mockup - but the fitness-device integrations
are **simulated** (see "What's mocked" below) so it runs end-to-end with
zero external accounts or credentials.

## Architecture

```
 Activity Provider Layer      Fitness Data              Team Sprint          Game Engine        Slack / Web / Mobile
 (Apple Health, Garmin,   ->  Normalization Layer   ->   Activity Engine  -> (scoring, chapters,  -> (Home tab, slash
  Fitbit, Google Health        (dedup, validation,        (ingest.ts)         streaks,               commands, admin
  Connect, ... - or mock)       anti-cheat)                                   achievements,          API)
                                                                               leaderboards)
```

- **`src/providers/`** - the `ActivityProvider` interface every fitness
  source implements, a normalization/validation step, cross-provider
  de-duplication (`dedup.ts`), anti-cheat screening (`antiCheat.ts`), and
  the ingestion pipeline (`ingest.ts`) that ties them together. Four mock
  providers (`src/providers/mock/`) simulate Apple Health, Garmin, Fitbit,
  and Google Health Connect.
- **`src/game-engine/`** - pure, unit-tested scoring logic: activity ->
  movement points, chapter/board progress, streaks, achievements,
  leaderboards, and the anti-"step count arms race" blended scoring model
  (PRD Section 40). No database or Slack code lives here on purpose, so
  it's trivially testable (see `test/`).
- **`src/api/`** - an Express admin/API service: the Challenge Builder
  (create/update challenges, chapters, themes, scoring config), team and
  participant management, and public leaderboard endpoints.
- **`src/slack-app/`** - a Slack Bolt app (Socket Mode for local dev):
  `/fitness` slash command family, the App Home tab dashboard, and
  notification-message builders (morning nudge, achievement callouts,
  competition alerts, comeback events).
- **`prisma/schema.prisma`** - the full data model: organizations, Slack
  installs, users, challenges, themes, chapters, events/obstacles, teams,
  device connections, normalized activity, VP transaction ledger,
  achievements, and prizes.
- **`src/scripts/settleChallenge.ts`** - turns ingested activity into VP
  transactions and unlocked achievements (participation bonuses, streak
  bonuses, chapter-arrival bonuses, first/second-place bonuses).

## Verified state of this scaffold

- `npm install`, `npm run typecheck` (strict TypeScript, zero errors), and
  `npm test` (25 unit tests covering the entire game engine - scoring,
  chapters, streaks, achievements, leaderboards - and cross-provider
  de-duplication) all pass as committed.
- `npm run db:generate` / `db:push` / `demo` need to reach
  `binaries.prisma.sh` to download Prisma's query engine the first time -
  a normal one-time step for any Prisma project. If you're running this in
  a network-restricted environment (a locked-down CI runner or sandbox),
  make sure that host is reachable; on a typical dev machine this just
  works. On an ordinary connection, `npm run db:generate && npm run db:push
  && npm run demo` (see Quickstart below) will seed the demo challenge and
  print a working leaderboard.

## Quickstart

Requires Node 20+.

```bash
npm install
npm run db:generate
npm run db:push       # creates prisma/dev.db (SQLite, zero setup)
npm run demo          # seeds a "Summer Sprint" challenge, simulates 20 days
                       # of activity for 6 employees across 2 teams, settles
                       # Victory Points, and prints the resulting leaderboard
npm test               # unit tests for the game engine + de-dup logic
```

To run the actual services:

```bash
npm run api:dev         # Express admin/API on :3001 (see .env ADMIN_API_KEY)
npm run slack:dev       # Slack Bolt app (needs real Slack app credentials - see below)
```

## Setting up the real Slack app

1. Go to https://api.slack.com/apps -> "Create New App" -> "From an app manifest".
2. Paste in `slack-manifest.yml` from this repo.
3. Under **Socket Mode**, generate an app-level token (`xapp-...`) and set `SLACK_APP_TOKEN`.
4. Under **OAuth & Permissions**, install the app to your workspace and copy the bot token (`xoxb-...`) into `SLACK_BOT_TOKEN`.
5. Copy `.env.example` to `.env` and fill in the Slack values.
6. Insert an `Organization` row whose `slackTeamId` matches your workspace's team ID (the seed script does this for a demo org automatically).

## What's mocked vs. real (and how to change that)

| Piece | Status | To make it real |
|---|---|---|
| Apple Health, Garmin, Fitbit, Google Health Connect | **Simulated** (`src/providers/mock/`) | Implement `ActivityProvider` (`src/providers/types.ts`) against each provider's real API/OAuth, register it in `src/providers/registry.ts` behind the `USE_MOCK_PROVIDERS` flag. Nothing else in the app changes. |
| Apple Health specifically | N/A - Apple Health has no server-side API | Needs a companion iOS app (HealthKit) that syncs to your backend, same as the referenced Outbreak/"A Step Ahead" model. |
| Database | SQLite (dev/demo) | Flip `datasource.provider` in `prisma/schema.prisma` to `"postgresql"`, point `DATABASE_URL` at the Postgres instance in `docker-compose.yml` (`docker compose up -d`), then `npm run db:migrate`. |
| Admin auth | Shared API key (`ADMIN_API_KEY` header) | Replace with Slack-workspace-scoped OAuth sessions using the existing `User.role` field, scoped per `organizationId`. |
| Notification scheduler | Message builders only (`src/slack-app/notifications.ts`), no cron | Add a scheduler (e.g. `node-cron` or a queue) that calls these builders + `client.chat.postMessage` on the configured cadence per challenge. |
| Multiple concurrent challenges per org | Schema supports it; Slack app assumes one `status: "active"` challenge | Straightforward Phase 3 extension - see PRD Section 45. |

## Mapping to the PRD

- **Section 43 (MVP)**: Slack OAuth/app/slash-commands/Home-tab/leaderboard,
  mock Apple Health/Garmin/Fitbit/Google Health Connect ingestion, teams,
  chapters, VP, achievements, and challenge-builder admin endpoints are all
  implemented here.
- **Section 44 (Phase 2)** and **Section 45 (Phase 3)**: intentionally not
  built - real OAuth integrations beyond the mocks, advanced game builder UI,
  HRIS/SSO/SCIM, multi-workspace support, prize fulfillment, and a web
  admin dashboard UI (today the admin surface is API-only; the Challenge
  Builder screens described in Section 21-24 still need a frontend).

## Project layout

```
prisma/schema.prisma       data model
prisma/seed.ts             demo data + end-to-end pipeline run
src/shared/types.ts        cross-cutting types (ScoringConfig, NormalizedActivity, ...)
src/game-engine/           pure scoring/chapters/streaks/achievements/leaderboard logic (unit tested)
src/providers/             activity provider interface, mocks, dedup, anti-cheat, ingestion
src/api/                   Express admin/API service (challenge builder, teams, prizes, leaderboard)
src/slack-app/             Slack Bolt app (commands, Home tab, notifications)
src/scripts/                settlement + demo scripts
slack-manifest.yml          one-paste Slack app setup
docker-compose.yml          Postgres for production use
test/                       vitest unit tests
```
