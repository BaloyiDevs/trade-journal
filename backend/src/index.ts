import cookieParser from "cookie-parser";
import { authRouter } from "./auth.js";
import express, {type Request, type Response } from "express";
import { pool } from "./db.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRouter);
const port = process.env.PORT ?? 3000;

app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok"});
});

app.get("/", (req: Request, res: Response) => {
  res.json({ name: "trade-journal-api", status: "running" });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});