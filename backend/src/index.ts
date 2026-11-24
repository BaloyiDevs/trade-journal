import express, {type Request, type Response } from "express";

const app = express();
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