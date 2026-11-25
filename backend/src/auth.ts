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