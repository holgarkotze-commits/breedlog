import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (e.g. /assets/index-abc123.js) — immutable, cache for 1 year
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
      lastModified: false,
    }),
  );

  // PWA manifest and service worker — must always be fresh
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        if (base === "sw.js" || base === "manifest.json") {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    }),
  );

  // SPA fallback — serve index.html for all non-API routes (never cache it)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
