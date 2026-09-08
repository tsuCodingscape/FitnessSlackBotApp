import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const prizesRouter = Router();

const prizeSchema = z.object({
  challengeId: z.string(),
  category: z.enum([
    "overall_1st",
    "overall_2nd",
    "overall_3rd",
    "most_improved",
    "best_team_spirit",
    "longest_streak",
    "custom",
  ]),
  scope: z.enum(["individual", "team"]).default("team"),
  kind: z.enum(["monetary", "physical_item", "gift_card", "pto", "company_reward", "custom", "none"]).default("custom"),
  description: z.string().min(1),
  value: z.string().optional(),
  hiddenUntilStart: z.boolean().default(false),
});

// Prize configuration is fully custom per challenge (PRD Section 25-26).
prizesRouter.post("/", async (req, res) => {
  const parsed = prizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const prize = await prisma.prize.create({ data: parsed.data });
  res.status(201).json(prize);
});

prizesRouter.get("/", async (req, res) => {
  const challengeId = req.query.challengeId as string;
  const prizes = await prisma.prize.findMany({ where: { challengeId } });
  res.json(prizes);
});

prizesRouter.delete("/:id", async (req, res) => {
  await prisma.prize.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
