import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

/**
 * Last-resort error handler. Express 5 forwards rejected promises from
 * async route handlers here, so a bad id or a DB constraint violation turns
 * into an HTTP error response instead of an unhandled rejection that would
 * take the whole API process down.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: record to update/delete not found. P2003: foreign key points at nothing.
    if (err.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({ error: "Referenced record does not exist" });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: "Already exists" });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
