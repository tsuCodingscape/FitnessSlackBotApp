import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAdminApiKey } from "./adminAuth.js";
import { challengesRouter } from "./routes/challenges.js";
import { teamsRouter } from "./routes/teams.js";
import { prizesRouter } from "./routes/prizes.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { participantsRouter } from "./routes/participants.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Leaderboards are read by the Slack app on behalf of any workspace member,
// so they're intentionally not behind the admin API key; everything that
// mutates challenge configuration or participant membership is.
app.use("/api/leaderboard", leaderboardRouter);

app.use("/api/challenges", requireAdminApiKey, challengesRouter);
app.use("/api/teams", requireAdminApiKey, teamsRouter);
app.use("/api/prizes", requireAdminApiKey, prizesRouter);
app.use("/api/participants", requireAdminApiKey, participantsRouter);

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => {
  console.log(`Team Sprint admin/API server listening on :${port}`);
});
