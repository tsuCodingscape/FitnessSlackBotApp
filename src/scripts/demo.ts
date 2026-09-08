/**
 * `npm run demo` - alias for the seed script. Resets the dev database,
 * simulates activity across 6 demo employees on 2 teams via the mock
 * providers, settles Victory Points, and prints the resulting leaderboard.
 * Kept as a separate entrypoint (rather than only `npm run seed`) since
 * "demo" is the more discoverable name for "show me this thing working".
 */
import "../../prisma/seed.js";
