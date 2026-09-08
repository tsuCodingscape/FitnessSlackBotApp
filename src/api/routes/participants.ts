import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const participantsRouter = Router();

const inviteSchema = z.object({
  organizationId: z.string(),
  slackUserId: z.string(),
  displayName: z.string(),
});

// Invite / add a participant (PRD Section 29). Idempotent: re-inviting an
// already-known Slack user just returns their existing profile, so retrying
// a bulk-import doesn't create duplicates.
participantsRouter.post("/invite", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { organizationId, slackUserId, displayName } = parsed.data;

  const user = await prisma.user.upsert({
    where: { organizationId_slackUserId: { organizationId, slackUserId } },
    create: { organizationId, slackUserId, displayName },
    update: { displayName },
  });
  res.status(201).json(user);
});

participantsRouter.delete("/:userId/challenges/:challengeId", async (req, res) => {
  const { userId, challengeId } = req.params;
  const teams = await prisma.team.findMany({ where: { challengeId }, select: { id: true } });
  await prisma.teamMembership.deleteMany({ where: { userId, teamId: { in: teams.map((t: { id: string }) => t.id) } } });
  res.status(204).send();
});

participantsRouter.get("/", async (req, res) => {
  const organizationId = req.query.organizationId as string;
  const users = await prisma.user.findMany({
    where: { organizationId },
    include: { deviceConnections: true, teamMemberships: { include: { team: true } } },
  });
  res.json(users);
});

// Device connection status (PRD Section 6, 28-29): which providers a
// participant has connected, and when they last synced.
participantsRouter.get("/:userId/devices", async (req, res) => {
  const devices = await prisma.deviceConnection.findMany({ where: { userId: req.params.userId } });
  res.json(devices);
});
