import type { Request, Response, NextFunction } from "express";
import { redis } from "./redis.js";

type Options = { prefix: string; max: number; windowSeconds: number };

export function rateLimit({ prefix, max, windowSeconds }: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${prefix}:${req.ip}`;

    // Create the counter with an expiry only if it doesn't exist yet
    await redis.set(key, 0, "EX", windowSeconds, "NX");
    const count = await redis.incr(key);

    if (count > max) {
      const retryAfter = await redis.ttl(key);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    next();
  };
}