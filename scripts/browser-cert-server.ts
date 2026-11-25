import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { setupVite } from "../server/vite";

// Test auth and synthetic checkout must never run against a farmer database or
// a public interface. This harness is disposable and owned by Playwright.
if (process.env.NODE_ENV !== "test" || process.env.USE_IN_MEMORY_STORAGE !== "1") {
  throw new Error("Browser certification requires explicit isolated test storage");
}
const app = express();
app.use(express.json({ limit: "20mb" }));
const server = createServer(app);
await registerRoutes(server, app);
await setupVite(server, app);
server.listen(5000, "127.0.0.1");
