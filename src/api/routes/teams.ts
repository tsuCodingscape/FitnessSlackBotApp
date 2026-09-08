import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const teamsRouter = Router();

const createTeamSchema = z.object({
  challengeId: z.string(),
  name: z.string().min(1),
  emoji: z.string().optional(),
  colorHex: z.string().optional(),
});

teamsRouter.post("/", async (req, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const team = await prisma.team.create({ data: parsed.data });
  res.status(201).json(team);
});

teamsRouter.get("/", async (req, res) => {
  const challengeId = req.query.challengeId as string | undefined;
  const teams = await prisma.team.findMany({
    where: challengeId ? { challengeId } : undefined,
    include: { memberships: { include: { user: true } } },
  });
  res.json(teams);
});

// Participant management (PRD Section 29): move between teams, lock teams, etc.
const moveParticipantSchema = z.object({
  userId: z.string(),
  toTeamId: z.string(),
});

teamsRouter.post("/move-participant", async (req, res) => {
  const parsed = moveParticipantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { userId, toTeamId } = parsed.data;

  const toTeam = await prisma.team.findUnique({ where: { id: toTeamId } });
  if (!toTeam) {
    res.status(404).json({ error: "Target team not found" });
    return;
  }
  if (toTeam.isLocked) {
    res.status(409).json({ error: "Target team is locked" });
    return;
  }

  await prisma.teamMembership.deleteMany({
    where: { userId, team: { challengeId: toTeam.challengeId } },
  });
  const membership = await prisma.teamMembership.create({ data: { userId, teamId: toTeamId } });

  await prisma.auditLog.create({
    data: {
      organizationId: (await prisma.challenge.findUniqueOrThrow({ where: { id: toTeam.challengeId } })).organizationId,
      challengeId: toTeam.challengeId,
      actorSlackId: req.header("x-actor-slack-id") ?? "unknown",
      action: "participant.moved_team",
      details: { userId, toTeamId },
    },
  });

  res.json(membership);
});

teamsRouter.patch("/:id/lock", async (req, res) => {
  const { locked } = req.body as { locked: boolean };
  const team = await prisma.team.update({ where: { id: req.params.id }, data: { isLocked: !!locked } });
  res.json(team);
});
