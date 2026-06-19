// Tiny backend proxy for the Anthropic Messages API.
//
// The browser must NEVER hold the API key, and the Anthropic API does not allow
// unrestricted cross-origin calls from a browser. So the React app calls
// POST /api/messages on this server, and this server forwards the request to
// Anthropic with the secret key + required version header attached.
//
// In production this same server also serves the built static files (dist/).

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present (Node >= 20.6 built-in, no dependency needed).
try {
  if (fs.existsSync(path.join(__dirname, ".env"))) {
    process.loadEnvFile(path.join(__dirname, ".env"));
  }
} catch {
  /* ignore — env may already be provided by the host */
}

const PORT = process.env.PORT || 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/messages", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: {
        message:
          "ANTHROPIC_API_KEY não configurada no servidor. Crie um arquivo .env com ANTHROPIC_API_KEY=sk-... e reinicie.",
      },
    });
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: { message: "Falha ao contatar a API Anthropic: " + e.message },
    });
  }
});

// Serve the built frontend in production (after `npm run build`).
const distDir = path.join(__dirname, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Proxy Anthropic ouvindo em http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn(
      "⚠  ANTHROPIC_API_KEY não definida — a geração de deliberações com IA falhará até configurá-la."
    );
  }
});
