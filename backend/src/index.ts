import express, {type Request, type Response } from "express";
import { pool } from "./db.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok"});
});

app.get("/", (req: Request, res: Response) => {
  res.json({ name: "trade-journal-api", status: "running" });
});

app.get("/db-check", async(req: Request, res: Response) => {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ database: "connected", time: result.rows[0].now});
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});