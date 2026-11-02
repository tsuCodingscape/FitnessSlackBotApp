# Team Sprint - MVP Scaffold (Architecture & Status)

Slack-native gamified fitness challenge platform, built from the full PRD. This doc tracks what was built, key decisions, and what's next. See [roadmap.md](roadmap.md) and [backlog.md](backlog.md) for the plan going forward.

## Decisions made (confirmed with Tina, 2026-09-02)

- **Deliverable:** a real, runnable MVP codebase (not just a design doc).
- **Stack:** Node.js / TypeScript. Slack Bolt (Socket Mode for dev), Express 5 admin API, Prisma 6 ORM.
- **Fitness integrations:** mocked for the MVP. Apple Health, Garmin, Fitbit and Google Health Connect are all simulated by a shared deterministic generator behind a common `ActivityProvider` interface, so swapping in real OAuth integrations later doesn't touch the game engine, API or Slack app.
- **Database:** SQLite for local dev/demo (zero setup); the schema is written to be portable to Postgres (no native enums/arrays). Switch the provider in `prisma/schema.prisma` and use the provided `docker-compose.yml` for production. Json defaults are written as `@default(dbgenerated("'{}'"))` because Prisma's SQLite connector emits `@default("{}")` unquoted, which SQLite rejects.
- **Days and timezones:** each challenge has an IANA timezone. "Today", daily goals, streaks and mock-provider days are all bucketed by local calendar day in that zone (`src/game-engine/days.ts`), not UTC.
- **Repo:** https://github.com/tsuCodingscape/FitnessSlackBotApp

## What's implemented

- **Data model** (`prisma/schema.prisma`): organizations/Slack installs, users, challenges, themes, chapters, events (obstacles/power challenges/sprints/comebacks), teams, device connections, normalized activity (unique per challenge, provider and source id), a VP transaction ledger, achievements, prizes, and an admin audit log.
- **Game engine** (`src/game-engine/`): activity -> movement points, chapter/board progress, chapter arrival order by time, streaks (current and every run in the history), achievements, leaderboard ranking, last-to-first detection, timezone day helpers, and the blended scoring function (PRD section 40). Blended scoring is implemented but not yet used by leaderboards.
- **Activity provider layer** (`src/providers/`): the `ActivityProvider` interface, 4 mock providers, cross-provider de-duplication (exact + time-overlap), anti-cheat screening (strict/moderate/relaxed), and the ingestion pipeline.
- **Admin/API** (`src/api/`): Challenge Builder endpoints, team management, prize configuration and leaderboard endpoints, behind a shared admin API key (placeholder for real auth). An error handler turns database and validation errors into 4xx/5xx responses.
- **Slack app** (`src/slack-app/`): `/fitness` commands, the App Home tab (including the viewer's own team chapter and personal rank), notification message builders, and `slack-manifest.yml`. Home-tab buttons are not yet wired, and nothing sends notifications yet.
- **Demo/seed** (`prisma/seed.ts`, `src/scripts/`): Summer Sprint, 2 teams, 6 users on different mock providers, 20 simulated days plus today, settled VP and achievements, printed leaderboard.
- **Setup:** `.env.example` lists every variable the code reads; copy it to `.env`.

## Verified

- **2026-09-02 (build sandbox):** `npm install`, strict typecheck (0 errors) and 25/25 unit tests passed. The Prisma schema was not exercised against a database.
- **2026-10-22 (PR #1):** the schema failed `prisma validate` and `db push` under SQLite; fixed. After the fix: typecheck clean, 46/46 unit tests, `npm run demo` on a fresh SQLite database, and API error handling checked against a running server.
- **2026-11-02 (Tina's machine):** `npm install`, `db:push` and `npm run demo` ran end to end with Prisma 6.19.3: about 360 activities ingested across six users, VP settled, leaderboard printed (Phoenix 53 VP / 39,383 movement points, Galaxy 34 VP / 34,504). `db:push` needs a `.env`; `.env.example` was added for that.

## Known issues

- Chapter goals are far too low (final goal 2,600 vs 35-50k movement points), so every team clears every chapter. Backlog issue 1.
- Settlement is not idempotent: running it twice double-awards VP. Backlog issue 3.
- Leaderboards rank by raw VP; blended scoring is unused. Backlog issue 2.
- Only the REST leaderboard honors visibility modes, and its anonymous aliases are unstable. Backlog issue 9.

Fixed in PR #1: the SQLite schema blocker, API crashes on bad requests, UTC day bucketing, first-to-destination ranking, and the Champion and Comeback Kid achievements.

## Not built yet

See the backlog: scheduled sync and notifications, Slack OAuth install and join flow, real provider integrations (Fitbit, Garmin, mobile companion for Apple Health / Health Connect), web admin dashboard, event engine, prize evaluation, org-scoped admin auth, Postgres deployment, enterprise features.
