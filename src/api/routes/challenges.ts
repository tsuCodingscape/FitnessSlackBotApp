import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { DEFAULT_SCORING_CONFIG } from "../../shared/types.js";

export const challengesRouter = Router();

const createChallengeSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  timezone: z.string().default("America/Los_Angeles"),
  competitionMode: z.enum(["individual", "team", "department", "company_vs_company"]).default("team"),
  difficulty: z.enum(["casual", "standard", "competitive", "extreme"]).default("standard"),
  participantLimit: z.number().int().positive().optional(),
  visibilityMode: z.enum(["public", "team_only", "anonymous", "private"]).default("team_only"),
  antiCheatMode: z.enum(["strict", "moderate", "relaxed"]).default("moderate"),
  allowManualEntry: z.boolean().default(true),
  theme: z
    .object({
      key: z.string(),
      displayName: z.string(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      logoUrl: z.string().optional(),
      boardEmojis: z.array(z.string()).optional(),
    })
    .optional(),
  terminology: z.record(z.string()).optional(),
  scoringConfig: z.any().optional(), // validated loosely; see ScoringConfig for the real shape
  chapters: z
    .array(
      z.object({
        order: z.number().int(),
        name: z.string(),
        description: z.string().optional(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        distanceGoal: z.number().int().positive(),
      })
    )
    .min(1),
});

// Challenge Builder: create (PRD Section 21-24).
challengesRouter.post("/", async (req, res) => {
  const parsed = createChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;

  const challenge = await prisma.challenge.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      timezone: input.timezone,
      competitionMode: input.competitionMode,
      difficulty: input.difficulty,
      participantLimit: input.participantLimit,
      visibilityMode: input.visibilityMode,
      antiCheatMode: input.antiCheatMode,
      allowManualEntry: input.allowManualEntry,
      terminology: input.terminology ?? {},
      scoringConfig: input.scoringConfig ?? DEFAULT_SCORING_CONFIG,
      status: "draft",
      chapters: { create: input.chapters },
      ...(input.theme
        ? {
            theme: {
              create: {
                key: input.theme.key,
                displayName: input.theme.displayName,
                primaryColor: input.theme.primaryColor ?? "#2563eb",
                accentColor: input.theme.accentColor ?? "#f97316",
                logoUrl: input.theme.logoUrl,
                boardEmojis: input.theme.boardEmojis ?? [],
              },
            },
          }
        : {}),
    },
    include: { chapters: true, theme: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      challengeId: challenge.id,
      actorSlackId: req.header("x-actor-slack-id") ?? "unknown",
      action: "challenge.created",
      details: { name: challenge.name },
    },
  });

  res.status(201).json(challenge);
});

challengesRouter.get("/", async (req, res) => {
  const organizationId = req.query.organizationId as string | undefined;
  const challenges = await prisma.challenge.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: { chapters: true, theme: true, teams: true, prizes: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(challenges);
});

challengesRouter.get("/:id", async (req, res) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: req.params.id },
    include: { chapters: true, theme: true, teams: { include: { memberships: true } }, prizes: true, events: true },
  });
  if (!challenge) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(challenge);
});

// Admin controls (PRD Section 30): start/pause/end, adjust scoring, difficulty, theme, etc.
const updateChallengeSchema = z.object({
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  scoringConfig: z.any().optional(),
  difficulty: z.enum(["casual", "standard", "competitive", "extreme"]).optional(),
  endDate: z.coerce.date().optional(),
  terminology: z.record(z.string()).optional(),
  visibilityMode: z.enum(["public", "team_only", "anonymous", "private"]).optional(),
  antiCheatMode: z.enum(["strict", "moderate", "relaxed"]).optional(),
});

challengesRouter.patch("/:id", async (req, res) => {
  const parsed = updateChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.challenge.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updated = await prisma.challenge.update({ where: { id: req.params.id }, data: parsed.data });

  // Every admin change is logged for transparency (Section 30).
  await prisma.auditLog.create({
    data: {
      organizationId: existing.organizationId,
      challengeId: existing.id,
      actorSlackId: req.header("x-actor-slack-id") ?? "unknown",
      action: "challenge.updated",
      details: parsed.data as object,
    },
  });

  res.json(updated);
});
