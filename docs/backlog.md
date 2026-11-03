# Team Sprint - Prioritized Backlog

Source: gaps found while building and running the MVP scaffold (code review plus the first full `npm run demo` run) against the PRD. Updated for PR #1 (schema fix, timezone-aware days, chapter arrival order, Champion/Comeback Kid achievements, API error handling).

This file is the single source for the GitHub issues: `docs/create-issues.mjs` reads every `### N. Title` section below and turns it into an issue. N is the GitHub issue number (#1 is PR #1, so issues start at #2); give a new issue the next unused number and correct it if GitHub assigns a different one. Edit the issue text here, not in the script. Each issue's metadata is the HTML comment directly under its heading; `#### ` headings become `## ` in the issue body.

Priority key: P0 = blocks a real pilot, P1 = needed for a credible launch, P2 = important, P3 = later.
Size key: S (<=2 days), M (~1 week), L (~2 weeks), XL (>2 weeks / needs a spike).

## Summary

| Issue | Pri | Size | Milestone | Title |
|---|-----|------|-----------|-------|
| #2 | P0 | M | M1 | Calibrate chapter goals and scoring defaults against realistic activity |
| #3 | P0 | M | M1 | Wire the blended scoring model into leaderboards |
| #4 | P0 | L | M1 | Make settlement incremental and idempotent |
| #5 | P0 | M | M1 | Scheduled activity sync worker |
| #6 | P0 | L | M1 | Slack OAuth install and multi-workspace token storage |
| #7 | P0 | L | M1 | Join Challenge flow and Home tab quick actions |
| #8 | P0 | M | M1 | Notification scheduler with per-challenge configuration |
| #9 | P0 | S | M1 | CI pipeline and database integration tests |
| #10 | P1 | M | M1 | Enforce visibility modes and privacy controls everywhere |
| #11 | P1 | L | M2 | Provider OAuth framework and secure token storage |
| #12 | P1 | L | M2 | Fitbit provider (Web API) |
| #13 | P1 | L | M2 | Garmin provider (Garmin Health API) |
| #14 | P1 | XL | M2 | Mobile companion app: Apple Health (HealthKit) and Android Health Connect |
| #15 | P2 | M | M2 | Spike: aggregator vs direct integrations for Samsung Health, Oura, Withings, Peloton and others |
| #16 | P2 | M | M2 | Anti-cheat review queue and expanded detection |
| #17 | P1 | L | M3 | Admin authentication and organization scoping |
| #18 | P1 | XL | M3 | Web admin dashboard MVP (Challenge Builder) |
| #19 | P2 | M | M3 | Challenge templates and theme library |
| #20 | P2 | M | M3 | Prize engine and winner announcement |
| #21 | P2 | S | M3 | Complete audit-log coverage and change history |
| #22 | P2 | M | M3 | Admin analytics and success metrics |
| #23 | P1 | L | M4 | Event engine: obstacles, power challenges, sprints, side quests, safehouses |
| #24 | P2 | M | M4 | Catch-up mechanics (comeback and underdog bonuses) |
| #25 | P2 | M | M4 | Team formation and balancing |
| #26 | P2 | M | M4 | Leaderboard variants: today, this week, most improved, streaks, achievements |
| #27 | P2 | S | M4 | Finish achievement fixes: Team Player and theme-able achievements |
| #28 | P3 | L | M4 | Game board visualization |
| #29 | P3 | M | M4 | Social features: reactions, shout-outs, achievement announcements |
| #30 | P2 | L | M5 | Production deployment on Postgres |
| #31 | P3 | XL | M5 | Enterprise: SSO/SCIM, HRIS, multi-challenge, multi-workspace, public API, white-label |

## M1 - Pilot-ready

Internal pilot in a real Slack workspace with simulated device data: join flow, scheduled sync/settlement/notifications, calibrated scoring, CI.

### 2. [P0] Calibrate chapter goals and scoring defaults against realistic activity
<!-- labels: P0, scoring, bug | size: M -->

#### Context
In the first full demo run (2026-11-02) Phoenix logged 39,383 movement points and Galaxy 34,504, against a seeded final-chapter goal of 2,600. After PR #1 changed the mock data, reruns land around 40-50k per team; the problem is the same. Every team clears every chapter within the first days, so board progress is meaningless and the only differentiator is the first/second-to-destination bonus (which, since PR #1, goes to whoever crossed the goal first).

#### Scope
- Derive chapter distance goals from team size x days x daily goal x difficulty instead of hard-coded numbers.
- Add difficulty presets (casual / standard / competitive / extreme) that scale daily goals, chapter goals and multipliers.
- Fix the seed data so a 4-week demo produces a close race with at least one team still mid-board on day 20.
- Make mock provider output independent of the sync window: rest days are currently drawn from a sequence that starts at `since`, so the same day can get different numbers on a re-sync.
- Add a unit test that fails if default goals can be cleared in under 50% of the challenge duration at average simulated activity.

#### Acceptance criteria
- [ ] Seed demo: final chapter is not reached by any team before the last week.
- [ ] Difficulty selection changes goals, verified by tests.
- [ ] Challenge Builder API accepts a difficulty and returns generated chapter goals.
- [ ] Re-syncing a past day with a different window returns the same mock values.

#### References
PRD 9, 39, 41; prisma/seed.ts; src/game-engine/scoring.ts; src/providers/mock/mockProviderFactory.ts

### 3. [P0] Wire the blended scoring model into leaderboards
<!-- labels: P0, scoring | size: M -->

#### Context
`blendedTeamScore` (40% objectives / 25% consistency / 20% activity / 10% events / 5% achievements) exists and is tested but nothing calls it. Leaderboards rank by raw VP then movement points, so the "avoid the step-count arms race" differentiator is not actually in effect.

#### Scope
- Compute normalized (0-1) sub-scores per team in one place (shared by API and Slack queries).
- Make the ranking mode a challenge setting: `vp` or `blended`, weights editable by admin.
- Replace the four copies of team movement aggregation (API leaderboard route, `getTeamLeaderboard` and `getTeamBoardProgress` in src/slack-app/queries.ts, seed) with one standings service; fold the per-user `getIndividualLeaderboard` into it too.
- Load activity once per request: the Home tab currently scans all challenge activity three times per open.

#### Acceptance criteria
- [ ] A team that walks 7k steps/day consistently can outrank a team with 2x the raw steps under default weights (covered by a test).
- [ ] API and Slack leaderboards return identical standings for the same challenge.

#### References
PRD 40; src/game-engine/scoring.ts; src/api/routes/leaderboard.ts; src/slack-app/queries.ts

### 4. [P0] Make settlement incremental and idempotent
<!-- labels: P0, backend, bug | size: L -->

#### Context
`settleChallenge` is a one-shot batch over the whole challenge history: running it twice double-awards every VP transaction, so nothing can run it on a schedule. Day bucketing is already timezone-aware since PR #1 (`dayKeyInTimezone`, `Challenge.timezone`), and streak VP now counts every streak in the history - an incremental version has to award each milestone once, as it is crossed, rather than recomputing.

#### Scope
- Add an idempotency key to VpTransaction (e.g. challengeId + reason + subject + day/chapter) with a unique index.
- Settle per day: only process days that are complete in the challenge timezone and not yet settled; track a `lastSettledDate` on Challenge. Helpers for local day boundaries are in src/game-engine/days.ts.
- Award team daily-goal VP once per team per day (currently awarded per user).
- Return a summary of what was awarded so the notification layer can announce it.

#### Acceptance criteria
- [ ] Running settlement twice produces identical totals.
- [ ] Late-arriving activity for an already-settled day is picked up without double-awarding.
- [ ] Integration test over SQLite covers re-run and late-arriving activity.

#### References
PRD 10, 34; src/scripts/settleChallenge.ts; src/game-engine/days.ts

### 5. [P0] Scheduled activity sync worker
<!-- labels: P0, backend | size: M -->

#### Context
Ingestion only runs from the seed script. The PRD target is near-real-time sync without the user opening anything.

#### Scope
- Add a worker process (node-cron or a queue such as BullMQ/pg-boss) that syncs each connected user every N minutes, passing the challenge timezone that `ingestActivityForUser` now requires.
- Per-connection backoff and `status=error` after repeated failures; surface in the participant device-health view.
- Trigger settlement (#4) after the end-of-day sync window.

#### Acceptance criteria
- [ ] `npm run worker` syncs all active-challenge participants on an interval.
- [ ] A failing provider does not block other users.
- [ ] `lastSyncAt` is updated per connection, not per user.

#### References
PRD 34; src/providers/ingest.ts

### 6. [P0] Slack OAuth install and multi-workspace token storage
<!-- labels: P0, slack | size: L -->

#### Context
The app boots with a single `SLACK_BOT_TOKEN` and never reads `SlackInstallation`, so only one hard-wired workspace can use it. `SLACK_CLIENT_ID/SECRET` are mentioned in a code comment but nothing reads them, and they are not in `.env.example`.

#### Scope
- Implement Bolt's OAuth install flow (HTTP mode) with an installation store backed by the SlackInstallation table.
- Create the Organization on first install; store the bot token encrypted.
- Add the OAuth variables to `.env.example`.
- Keep Socket Mode as a dev option.
- Handle `app_uninstalled` / `tokens_revoked`.

#### Acceptance criteria
- [ ] A second workspace can install the app and gets its own Organization.
- [ ] No code path reads the bot token from env in production mode.

#### References
PRD 15; src/slack-app/app.ts; prisma SlackInstallation

### 7. [P0] Join Challenge flow and Home tab quick actions
<!-- labels: P0, slack | size: L -->

#### Context
The invitation -> join -> pick team -> choose avatar -> connect device journey (PRD section 6) is not implemented; users only exist if an admin adds them through the API. `/fitness today` tells unknown users to "click Join Challenge in the announcement", but no such button exists. On the Home tab, `view_leaderboard`, `view_team`, `connect_device` and `invite_coworker` just ack. (Personal rank is computed and shown since PR #1.)

#### Scope
- Admin-posted announcement with a [Join Challenge] button.
- Onboarding modal: confirm identity, select or be assigned a team, choose avatar emoji, connect a source.
- Implement the four Home-tab actions (leaderboard modal, team modal, connect-device launcher, invite shortcut).
- Publish a Home tab when there is no active challenge or the workspace isn't set up (it is currently left blank).

#### Acceptance criteria
- [ ] A new user can go from announcement to joined-with-device entirely in Slack.
- [ ] No Home-tab button is a no-op.
- [ ] The Home tab is never blank.

#### References
PRD 6, 16; src/slack-app/app.ts; src/slack-app/blocks/homeTab.ts; src/slack-app/commands/fitness.ts

### 8. [P0] Notification scheduler with per-challenge configuration
<!-- labels: P0, slack | size: M -->

#### Context
Message builders exist (morning nudge, midday standing, achievement, team milestone, overtake, comeback) but nothing sends them.

#### Scope
- Scheduler that posts to channel / DM on a configurable cadence with quiet hours and the challenge timezone.
- Trigger event-driven messages from settlement results (team reached chapter, overtaken, achievement unlocked).
- Per-challenge settings: enable/disable each type, frequency cap, destination channel.
- Respect user opt-out.

#### Acceptance criteria
- [ ] Enabling a notification type produces the expected message in a test workspace.
- [ ] No user receives more than the configured max per day.

#### References
PRD 17; src/slack-app/notifications.ts

### 9. [P0] CI pipeline and database integration tests
<!-- labels: P0, devex | size: S -->

#### Context
Typecheck and 46 unit tests pass, but only pure logic is tested. Ingest, settlement and the API/Slack query layer have no automated coverage, and nothing runs on PRs. PR #1's database fixes (Prisma 6.19 and quoted Json defaults for SQLite) were only verified by hand.

#### Scope
- GitHub Actions: install, `prisma validate`, `prisma generate`, typecheck, vitest on every PR.
- SQLite-backed integration tests for ingest -> settle -> leaderboard using the seed fixtures, including `prisma db push` on a fresh database.
- API tests for error handling (unknown ids return 404, invalid input returns 400).
- Document the Prisma upgrade path, including why Json defaults use `@default(dbgenerated("'{}'"))`.
- Add ESLint/Prettier.

#### Acceptance criteria
- [ ] PRs show a green/red check.
- [ ] Integration tests fail if settlement double-awards.

#### References
README "Verified state"; package.json; prisma/schema.prisma

### 10. [P1] Enforce visibility modes and privacy controls everywhere
<!-- labels: P1, privacy, slack | size: M -->

#### Context
visibilityMode (public / team_only / anonymous / private) is honored only by the REST leaderboard, and only partly: anonymous aliases ("Team A", "Participant 1") depend on unordered query results, so they can change between requests, and the response still carries real team and user ids. The Slack leaderboard, `/fitness team` and the Home tab always show real names. Participants have no way to leave a challenge, disconnect a device or delete their data from Slack.

#### Scope
- Single `applyVisibility()` helper used by API, slash commands and Home tab, with stable aliases and no real ids in anonymous mode.
- `/fitness leave`, `/fitness disconnect`, `/fitness delete-my-data`.
- Request only the data scopes the challenge needs when connecting a device; show what coworkers can see.
- Never expose heart rate, weight, sleep or calories unless the challenge requires it and the user opts in.

#### Acceptance criteria
- [ ] Anonymous challenge shows no real names or ids in any surface, and aliases are stable across requests (tests).
- [ ] Deleting data removes Activity, DeviceConnection and VpTransaction rows tied to the user.

#### References
PRD 20, 35, 36; src/api/routes/leaderboard.ts

## M2 - Real devices

Real fitness data from Fitbit, Garmin, Apple Health and Android Health Connect replaces the mock providers.

### 11. [P1] Provider OAuth framework and secure token storage
<!-- labels: P1, integrations, backend | size: L -->

#### Context
Device connections carry placeholder fields (`accessToken`, `refreshToken`) with no connect flow, encryption, refresh or revocation.

#### Scope
- Generic OAuth2 connect/callback endpoints with `state` and PKCE where supported.
- Encrypt tokens at rest (KMS or libsodium envelope); never log them.
- Refresh-token handling, revocation webhooks, and a "re-connect your device" DM when a connection breaks.
- Replace the mock registry entries behind `USE_MOCK_PROVIDERS` per provider.

#### Acceptance criteria
- [ ] Connect, disconnect and token refresh work against a sandbox provider.
- [ ] Secrets never appear in logs or DB dumps in plaintext.

#### References
PRD 31, 35; src/providers/registry.ts

### 12. [P1] Fitbit provider (Web API)
<!-- labels: P1, integrations | size: L -->

#### Context
Fitbit is the most straightforward cloud-API integration and the best first real provider.

#### Scope
- Implement ActivityProvider using the Fitbit Web API (steps, distance, active minutes), with webhook subscriptions for near-real-time updates.
- Map to NormalizedActivity with stable sourceIds for dedup, bucketing daily totals by the `timeZone` passed to `fetchActivities`.
- Confirm the current Fitbit/Google developer terms and Fitbit API status before building.

#### Acceptance criteria
- [ ] A real Fitbit account's steps appear in a test challenge within minutes.
- [ ] Re-syncing the same day never double-counts.

#### References
PRD 6, 31; src/providers/types.ts

### 13. [P1] Garmin provider (Garmin Health API)
<!-- labels: P1, integrations | size: L -->

#### Context
Garmin access requires approval for the Garmin Connect developer program and works through push notifications rather than polling.

#### Scope
- Apply for Garmin Health API access early (long lead time).
- Implement a push-based ingestion endpoint and map daily summaries/activities to NormalizedActivity.
- Handle backfill requests and duplicate deliveries.

#### Acceptance criteria
- [ ] Garmin test device data flows into a challenge.
- [ ] Duplicate pushes are idempotent.

#### References
PRD 6, 31

### 14. [P1] Mobile companion app: Apple Health (HealthKit) and Android Health Connect
<!-- labels: P1, integrations, mobile | size: XL -->

#### Context
Apple Health has no server-side API and Android Health Connect is an on-device API, so both need a small companion app that reads permitted data types and uploads normalized activity. This also covers Apple Watch, which reports through Apple Health. Validate current Google guidance for Health Connect and the status of legacy Google Fit REST APIs before design.

#### Scope
- Decide native (Swift/Kotlin) vs cross-platform (React Native/Flutter) - spike first.
- Minimal UI: sign in with Slack, choose challenge, grant only steps/distance/exercise minutes, background sync.
- Authenticated upload endpoint with per-device source ids; server-side dedup against other providers.
- App Store / Play Store review, privacy labels and data-safety forms.

#### Acceptance criteria
- [ ] A user installs the app, links their Slack identity, and watch/phone steps appear in the challenge without manual steps.
- [ ] Only the scopes the challenge needs are requested.

#### References
PRD 6, 31, 35

### 15. [P2] Spike: aggregator vs direct integrations for Samsung Health, Oura, Withings, Peloton and others
<!-- labels: P2, integrations | size: M -->

#### Context
Building each wearable separately is expensive. Aggregator APIs can cover long-tail devices, with cost, privacy and data-residency trade-offs.

#### Scope
- Compare 2-3 aggregators plus direct integration on coverage, cost per active user, latency and data handling.
- Produce a recommendation and a build/buy decision record.

#### Acceptance criteria
- [ ] Decision doc committed under docs/.
- [ ] Follow-up issues created for the chosen path.

#### References
PRD 31, 44

### 16. [P2] Anti-cheat review queue and expanded detection
<!-- labels: P2, anti-cheat | size: M -->

#### Context
Detection today is four simple thresholds. Flagged activity is stored (`flagged=true`) but there is no way for an admin to review it, and several PRD signals are absent. A re-sync that now rejects an activity (strict mode) leaves the row accepted by an earlier sync in place.

#### Scope
- Admin review queue: approve / reject / explain, with audit entries.
- Add signals: retroactive bulk uploads, repeated identical days, impossible step velocity, device anomalies.
- Per-challenge strict/moderate/relaxed behavior and the manual-entry toggle enforced in ingest.
- On re-sync, remove or flag previously stored rows that are now rejected.

#### Acceptance criteria
- [ ] Flagged items appear in a queue and approved ones start counting toward scores.
- [ ] Each rule has unit tests with true/false positives.

#### References
PRD 37; src/providers/antiCheat.ts; src/providers/ingest.ts

## M3 - Admin experience

HR/People admins can build and run a challenge without engineering help: web dashboard, templates, theming, prizes, analytics.

### 17. [P1] Admin authentication and organization scoping
<!-- labels: P1, security, backend | size: L -->

#### Context
Admin routes use one shared API key, and no route is scoped by organization, so any key holder can read or change any company's data (e.g. `GET /api/participants` without `organizationId` returns users from every organization). The leaderboard endpoint is open to anyone who knows a challengeId.

#### Scope
- Slack OIDC (Sign in with Slack) sessions; use `User.role` for admin/captain/participant.
- Enforce organizationId on every query via middleware.
- Signed, expiring tokens for the leaderboard endpoint, or restrict it to authenticated members.
- Rate limiting and request logging; compare any remaining shared secrets in constant time.

#### Acceptance criteria
- [ ] Cross-organization access attempts return 403/404 (tests).
- [ ] ADMIN_API_KEY removed from production configuration.

#### References
PRD 28-30; src/api/adminAuth.ts; src/api/routes/participants.ts

### 18. [P1] Web admin dashboard MVP (Challenge Builder)
<!-- labels: P1, frontend, admin | size: XL -->

#### Context
The Challenge Builder exists only as REST endpoints. HR admins need a UI.

#### Scope
- Screens: challenge info, chapters, scoring, difficulty, theme, terminology, prizes, anti-cheat and visibility settings.
- Participant management: invite, remove, move teams, lock teams, pause, resend invite, device status.
- Challenge controls: start/pause/extend/end, bonus VP, with a visible change log.
- Live standings and basic engagement stats.
- Validate `scoringConfig` against its real shape on create/update (it is accepted as `z.any()` today, and one bad value breaks every leaderboard).

#### Acceptance criteria
- [ ] An admin creates and launches a full challenge without touching the API.
- [ ] All changes are written to the audit log.

#### References
PRD 21-24, 28-30; src/api/routes/challenges.ts

### 19. [P2] Challenge templates and theme library
<!-- labels: P2, admin | size: M -->

#### Context
Admins should be able to launch quickly from Quick Step Challenge, Summer Sprint, Office Olympics, Department Battle and Charity templates, and pick themes (Summer, Space, Zombies, Olympics, Fantasy, Corporate, Custom).

#### Scope
- Template definitions (duration, mode, chapters, scoring, events) and a theme registry (emojis, copy, colors, achievement names).
- Apply custom terminology (VP -> Team XP, Team -> Squad, ...) in every Slack surface; today only the leaderboard VP label uses it.
- Logo/color branding for announcements.

#### Acceptance criteria
- [ ] Creating a challenge from a template yields a runnable setup.
- [ ] Renaming a term changes it everywhere in Slack output.

#### References
PRD 22-24, 27

### 20. [P2] Prize engine and winner announcement
<!-- labels: P2, admin | size: M -->

#### Context
Prizes are stored but never evaluated. Nothing determines winners, hides prizes until start, or announces results.

#### Scope
- Compute winners at completion: overall placements, most improved, longest streak, best team spirit (admin-picked), custom.
- Hide-until-start flag respected in Slack and dashboard.
- Winner announcement message and a CSV export for fulfillment.

#### Acceptance criteria
- [ ] Completing a seeded challenge produces correct winner records and an announcement.
- [ ] Hidden prizes are not visible before start.

#### References
PRD 25-26

### 21. [P2] Complete audit-log coverage and change history
<!-- labels: P2, admin, backend | size: S -->

#### Context
Only challenge create/update and participant moves write AuditLog rows; team creation, prize changes, locks, bonus VP and removals do not.

#### Scope
- Audit helper used by every mutating route and Slack admin action.
- Read endpoint and dashboard view of the change history.

#### Acceptance criteria
- [ ] Every mutating endpoint has a test asserting an audit row.

#### References
PRD 30

### 22. [P2] Admin analytics and success metrics
<!-- labels: P2, analytics | size: M -->

#### Context
The PRD defines activation, engagement, fitness, retention and business metrics, but nothing captures them.

#### Scope
- Event tracking for invite -> join -> connect -> first activity, daily/weekly actives, leaderboard views.
- Dashboard cards: participation rate, device-connection rate, active days, team goal completion, streaks.
- Keep health data out of analytics - aggregate counts only.

#### Acceptance criteria
- [ ] Dashboard shows the activation funnel for a seeded challenge.

#### References
PRD 28, 46

## M4 - Game depth & social

Obstacles, power events, catch-up mechanics, team formation, richer leaderboards, social features.

### 23. [P1] Event engine: obstacles, power challenges, sprints, side quests, safehouses
<!-- labels: P1, game-engine | size: L -->

#### Context
The ChallengeEvent table exists but no logic uses it. Events are the main thing that makes this feel like a game rather than a step ranking.

#### Scope
- Event types with config schemas and validation (target points, multiplier, bonus VP, window).
- Apply multipliers during power windows in movement-point calculation.
- Track obstacle/side-quest completion per team and award VP through the idempotent ledger (#4).
- Admin API (and later dashboard) to schedule events; Slack announcements at start/finish.

#### Acceptance criteria
- [ ] A power challenge doubles points only inside its window (tests).
- [ ] An obstacle must be cleared before the team can advance past it.

#### References
PRD 13

### 24. [P2] Catch-up mechanics (comeback and underdog bonuses)
<!-- labels: P2, game-engine | size: M -->

#### Context
Prevents the leaderboard from going stale once a team pulls ahead. Since PR #1, `teamsThatWentFromLastToFirst` replays standings over time and can be reused for trailing-team detection.

#### Scope
- Detect last-place/trailing teams on a schedule and auto-create comeback events with configurable thresholds.
- Admin toggle and caps so bonuses cannot be farmed.

#### Acceptance criteria
- [ ] Enabling the setting creates a comeback event for the trailing team and announces it.

#### References
PRD 14; src/game-engine/leaderboard.ts

### 25. [P2] Team formation and balancing
<!-- labels: P2, teams | size: M -->

#### Context
Only manual team creation and moves exist.

#### Scope
- Modes: random, captain's choice, employee-selected, department-based (from Slack profile fields).
- Balancing by historical activity and max participants per team; admin override and lock.
- Respect participantLimit.

#### Acceptance criteria
- [ ] Auto-balanced teams are within a configurable activity variance (tests with fixtures).

#### References
PRD 11-12

### 26. [P2] Leaderboard variants: today, this week, most improved, streaks, achievements
<!-- labels: P2, slack | size: M -->

#### Context
Only the overall team leaderboard is exposed in Slack; `buildMostImprovedLeaderboard` exists but is unused. An individual leaderboard query exists since PR #1 but is only used for the Home tab rank.

#### Scope
- `/fitness leaderboard [today|week|improved|streaks|achievements]` and a Home-tab toggle.
- Window queries share the standings service from #3.

#### Acceptance criteria
- [ ] Each variant returns the expected ordering on seed data.

#### References
PRD 19; src/game-engine/leaderboard.ts; src/slack-app/queries.ts

### 27. [P2] Finish achievement fixes: Team Player and theme-able achievements
<!-- labels: P2, game-engine, bug | size: S -->

#### Context
PR #1 wired up Champion (chapter wins from arrival order) and Comeback Kid (standings replayed over time), so every achievement can now unlock. Two gaps remain: Team Player counts a user's personal goal days rather than contribution to a team goal, and achievement names and emojis are fixed rather than following the challenge theme. Comeback Kid is judged on movement-point standings, not VP; confirm that is the intended rule.

#### Scope
- Redefine Team Player against actual team-goal contribution (depends on the per-team daily goal from #4).
- Theme-able achievement names/emojis per challenge.
- Decide whether Comeback Kid uses movement points or VP standings.

#### Acceptance criteria
- [ ] Team Player unlocks only for members who contributed on a day the team hit its goal (unit test).
- [ ] A theme can rename an achievement and the new name shows in Slack.

#### References
PRD 38; src/scripts/settleChallenge.ts; src/game-engine/achievements.ts

### 28. [P3] Game board visualization
<!-- labels: P3, frontend, slack | size: L -->

#### Context
Each challenge should show a themed board with team markers and the next event. Only a progress percentage exists today.

#### Scope
- Render the board as an image (server-side SVG/PNG) or Block Kit and embed it in the Home tab and announcements.
- Use theme emojis/colors from the Theme record.

#### Acceptance criteria
- [ ] Home tab shows an up-to-date board for the user's challenge.

#### References
PRD 8

### 29. [P3] Social features: reactions, shout-outs, achievement announcements
<!-- labels: P3, slack | size: M -->

#### Context
Social accountability is a key engagement driver, but participation must never feel forced or embarrassing.

#### Scope
- Post opt-in achievement callouts with reaction prompts; `/fitness shoutout @user`.
- Respect visibility mode and per-user opt-out.

#### Acceptance criteria
- [ ] Shout-outs and achievement posts appear in the configured channel and honor opt-outs.

#### References
PRD 18

## M5 - Enterprise & scale

Production hosting on Postgres, SSO/SCIM/HRIS, multi-workspace, API, white-label.

### 30. [P2] Production deployment on Postgres
<!-- labels: P2, infra | size: L -->

#### Context
The scaffold runs on SQLite. Production needs Postgres (provider switch, native enums where useful), migrations, and a deployable HTTP-mode Slack app plus worker.

#### Scope
- Switch the datasource to postgresql, generate migrations, add indexes for leaderboard queries. Check the quoted Json defaults (`dbgenerated("'{}'")`) against jsonb when switching.
- Dockerfile(s) for api, slack-app and worker; environment configuration and secrets management.
- Structured logging, error tracking, health checks, backups.

#### Acceptance criteria
- [ ] Staging deployment passes the integration test suite against Postgres.

#### References
README "Going to production"; docker-compose.yml; prisma/schema.prisma

### 31. [P3] Enterprise: SSO/SCIM, HRIS, multi-challenge, multi-workspace, public API, white-label
<!-- labels: P3, enterprise | size: XL -->

#### Context
Phase 3 capabilities from the PRD. Break into separate epics when scheduled.

#### Scope
- SSO and SCIM provisioning; HRIS sync for departments.
- Concurrent challenges per org (the Slack app currently assumes one active challenge).
- Org-level analytics and reporting; public API; white-label branding.

#### Acceptance criteria
- [ ] Scoped separately when M1-M4 are complete.

#### References
PRD 45
