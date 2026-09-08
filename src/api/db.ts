import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance across the API process.
export const prisma = new PrismaClient();
