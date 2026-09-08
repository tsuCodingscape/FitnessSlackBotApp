import { PrismaClient } from "@prisma/client";

/**
 * The Slack app reads challenge/team/activity data directly via Prisma
 * rather than round-tripping through the admin API (which exists mainly
 * for the challenge-builder / admin-dashboard surface). In a larger
 * deployment you'd likely put a thin read API in front of this instead
 * of sharing a Prisma client across processes, but for the MVP this
 * keeps Slack interactions (which need to respond within Slack's ~3s
 * ack window) fast and simple.
 */
export const prisma = new PrismaClient();
