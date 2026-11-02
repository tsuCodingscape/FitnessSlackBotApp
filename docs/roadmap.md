# Team Sprint - Roadmap

Companion to the prioritized backlog (30 issues, see [backlog.md](backlog.md) and the GitHub milestones of the same names). Sizes are rough: S <= 2 days, M ~ 1 week, L ~ 2 weeks, XL > 2 weeks or needs a spike. No calendar dates are committed because they depend on team size; sequencing and dependencies are what matter here.

## Where we are (updated 2026-11-02)

The MVP scaffold runs end to end on a developer machine: `npm install`, `npm run db:push` and `npm run demo` seed a Summer Sprint challenge with six simulated users on four mock providers, ingest roughly 360 activities, settle Victory Points and print a team leaderboard. Typecheck is clean and 46 unit tests pass.

PR #1 fixed the problems that stopped the scaffold from running or scoring correctly:

- The Prisma schema was rejected under SQLite, so no database command worked. Prisma is now 6.19 and Json defaults are quoted.
- A bad request (e.g. an unknown id) could crash the API process. Express 5 and an error handler now return 4xx/5xx.
- Days were bucketed in UTC. "Today", daily goals and streaks now use `Challenge.timezone`, and an unfinished today no longer resets a streak.
- First-to-destination went to whoever led at the end. It now goes to the team that crossed each chapter goal first.
- Champion and Comeback Kid could never unlock. Both are now computed, and streak VP counts every streak, not just the current one.
- Activity uniqueness is scoped per challenge; challenge timezones and the team-lock body are validated.

What the first full run still teaches us:

- **Scoring is not calibrated.** Teams log 35-50k movement points against a final-chapter goal of 2,600, so every team clears every chapter within days. This is the first thing to fix (issue 1), because a pilot with a pointless board will not retain people.
- **The "not a step-count arms race" differentiator is built but not switched on.** The blended scoring function exists and is tested, but leaderboards still rank by raw VP (issue 2).
- **Settlement is a one-shot batch and double-awards if rerun**, so nothing can run on a schedule until it is idempotent (issue 3).

## Milestones

### M1 - Pilot-ready (9 issues, mostly P0)

Goal: a Codingscape internal pilot in a real Slack workspace, on simulated device data, that people can join and want to come back to.

Order of work: calibrate scoring (1) and wire blended scoring (2) -> idempotent daily settlement (3) -> scheduled sync worker (4) -> Slack OAuth install (5) -> Join Challenge flow and Home actions (6) -> notification scheduler (7) -> privacy enforcement (9). CI and DB integration tests (8) start first and run alongside everything else.

Exit criteria: a 2-week pilot runs unattended, standings are close, daily notifications arrive, and re-running any job changes nothing.

### M2 - Real devices (6 issues)

Goal: real activity data replaces the simulator.

Start the long-lead items on day one of M1: apply for Garmin Health API access and decide the mobile-companion approach (native vs cross-platform spike). Build the OAuth framework (10) and Fitbit (11) first, because they are the fastest path to real data. The mobile companion app (13) is the largest single item and the only route to Apple Health/Apple Watch and Android Health Connect, since neither has a server-side API; plan for App Store and Play Store review time. The aggregator-vs-direct spike (14) decides how Samsung, Oura, Withings and Peloton are covered.

Exit criteria: at least Fitbit plus one mobile platform feeding a live challenge with no double counting across sources.

### M3 - Admin experience (6 issues)

Goal: an HR or People admin runs a challenge without engineering help.

Admin authentication and organization scoping (16) must land before any customer data is hosted, because the API is currently unscoped. Then the web dashboard (17), templates and theming (18), prizes (19), audit coverage (20) and analytics (21).

Exit criteria: a non-engineer creates, launches, adjusts and closes a challenge from the dashboard, with winners and prizes announced automatically.

### M4 - Game depth and social (7 issues)

Goal: make each challenge feel different. The event engine (22) is the keystone: obstacles, power windows, sprints and side quests turn a ranking into a game. Catch-up mechanics (23), team formation and balancing (24), leaderboard variants (25), the remaining achievement work (26, now small since PR #1), board visualization (27) and social features (28) follow.

M4 can overlap M2/M3 once M1 is done, because it touches the game engine rather than integrations or admin UI.

### M5 - Enterprise and scale (2 issues, to be broken down later)

Production deployment on Postgres (29) is needed before any external customer; SSO/SCIM/HRIS, concurrent challenges, multi-workspace and white-label (30) are scoped when there is customer demand.

## Dependencies and critical path

- Idempotent settlement (3) -> scheduled worker (4) -> notifications (7). Do not schedule anything before 3.
- Per-team daily goal in settlement (3) -> Team Player redefinition (26).
- Shared standings service (2) -> leaderboard variants (25), catch-up mechanics (23) and analytics (21).
- OAuth framework (10) -> every real provider (11, 12) and the companion app's sign-in (13).
- Admin auth and org scoping (16) -> web dashboard (17) -> templates and prizes (18, 19).
- Event engine (22) -> catch-up (23) and side quests/obstacles content in templates (18).

## Lead-time risks to start early

1. Garmin Health API approval is a business application and can take weeks.
2. App Store / Play Store review and privacy disclosures for the companion app, including health-data declarations.
3. Slack Marketplace review if the app is ever distributed beyond Codingscape's own workspace.
4. Provider terms and API status (Fitbit/Google developer terms and Google's Health Connect guidance) should be re-checked before committing to a build; they change.
5. Health data compliance: collect only the scopes a challenge needs, keep health metrics out of analytics, and review employer-wellness regulations with counsel before selling to customers. This is a planning note, not legal advice.

## Decisions needed from the team

1. Pilot audience and size (Codingscape-only first, or a friendly customer).
2. Companion app approach: native Swift/Kotlin vs React Native/Flutter.
3. Build vs buy for the long tail of wearables (spike in issue 14).
4. Hosting target and who owns production operations (needed for issue 29).
5. Whether Team Sprint is an internal tool, a Codingscape client offering, or a product; this changes the weight of M3 and M5.

## How to use this

Issue text lives only in [backlog.md](backlog.md). To create the labels, milestones and issues on GitHub (needs a working, authenticated `gh` and write access to the repo):

```bash
node docs/create-issues.mjs --dry-run   # print what would be created; never calls gh
node docs/create-issues.mjs             # create anything missing
```

The script is safe to re-run: labels are updated in place, and milestones and issues whose title already exists are skipped. If you change an issue's title in the backlog after creating it, the script will treat it as new, so rename it on GitHub too.
