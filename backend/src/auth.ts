import { rateLimit } from "./rateLimit.js";
import { randomBytes } from "node:crypto";
import { redis } from "./redis.js";
import { Router, type Request, type Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { pool } from "./db.js";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

authRouter.post("/signup", async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and a password of at least 8 characters" });
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = await argon2.hash(password);

  try {
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That email is already registered" });
      return;
    }
    throw err;
  }
});

const SESSION_COOKIE = "sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

authRouter.post(
  "/signin",
  rateLimit({ prefix: "signin", max: 5, windowSeconds: 15 * 60 }),
  async (req: Request, res: Response) => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your email and password" });
    return;
  }

  const { email, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];

  const valid = user && (await argon2.verify(user.password_hash, password));
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const sessionId = randomBytes(32).toString("hex");
  await redis.set(`session:${sessionId}`, user.id, "EX", SESSION_TTL_SECONDS);

  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });

  res.json({ id: user.id, email: user.email });
});

authRouter.get("/me", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const userId = await redis.get(`session:${sessionId}`);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const result = await pool.query(
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [userId]
  );
  if (!result.rows[0]) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  res.json(result.rows[0]);
});

authRouter.post("/signout",
    rateLimit({ prefix: "signup", max: 10, windowSeconds: 60 * 60 }),
     async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) {
    await redis.del(`session:${sessionId}`);
  }
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});