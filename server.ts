import express from "express";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Static API or health routes can go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve static assets or use Vite in dev
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from dist
    app.use(express.static(distPath));
    
    // Explicitly handle manifest.json and sw.js
    app.get("/manifest.json", (req, res) => {
      res.sendFile(path.join(distPath, "manifest.json"));
    });
    app.get("/sw.js", (req, res) => {
      res.sendFile(path.join(distPath, "sw.js"));
    });
    
    // All other requests fall back to index.html for SPA
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
