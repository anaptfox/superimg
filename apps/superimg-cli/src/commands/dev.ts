//! Dev server command - Hono with Vite middleware

import { Hono } from "hono";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "node:http";
import { resolve, join, dirname } from "node:path";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";

const execAsync = promisify(exec);

interface DevOptions {
  template: string;
  port: string;
  open: boolean;
}

export async function devCommand(template: string, options: DevOptions) {
  // Validate template file exists
  const templatePath = resolve(template);
  const { existsSync } = await import("node:fs");
  if (!existsSync(templatePath)) {
    console.error(`Error: Template file not found: ${templatePath}`);
    process.exit(1);
  }

  // Resolve the dev-ui package root via workspace dependency
  const require = createRequire(import.meta.url);
  const devRoot = dirname(require.resolve("@superimg/dev-ui/package.json"));

  // Create Vite in middleware mode for full control over route ordering
  const vite = await createViteServer({
    root: devRoot,
    server: { middlewareMode: true },
    appType: "custom",
    configFile: false,
  });

  const app = new Hono();

  // API routes run BEFORE Vite middleware - this fixes the ordering issue
  app.get("/api/config", async (c) => {
    try {
      const templateModule = await vite.ssrLoadModule(templatePath);
      const config = templateModule.config || templateModule.default?.config || {};
      return c.json({
        width: config.width ?? 1920,
        height: config.height ?? 1080,
        fps: config.fps ?? 60,
        durationSeconds: config.durationSeconds ?? 5,
        outputs: config.outputs,
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  const port = parseInt(options.port, 10);
  const url = `http://localhost:${port}?template=${encodeURIComponent(templatePath)}`;

  // Create HTTP server that tries Hono first, then falls back to Vite
  const server = createHttpServer(async (req, res) => {
    // Check if this is an API route that Hono should handle
    if (req.url?.startsWith("/api/")) {
      const response = await app.fetch(
        new Request(`http://localhost:${port}${req.url}`, {
          method: req.method,
          headers: Object.entries(req.headers).reduce(
            (acc, [k, v]) => {
              if (v) acc[k] = Array.isArray(v) ? v.join(", ") : v;
              return acc;
            },
            {} as Record<string, string>
          ),
        })
      );

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const body = await response.text();
      res.end(body);
      return;
    }

    // HTML requests (root or no extension) → serve index.html with Vite transform
    const url = req.url || "/";
    const isHtmlRequest =
      url === "/" ||
      url.split("?")[0] === "/" ||
      (!url.includes(".") && !url.startsWith("/@") && !url.startsWith("/__"));

    if (isHtmlRequest) {
      const htmlPath = join(devRoot, "index.html");
      let html = readFileSync(htmlPath, "utf-8");
      html = await vite.transformIndexHtml(url, html);
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    }

    // Everything else goes to Vite (JS, CSS, HMR, etc.)
    vite.middlewares(req, res);
  });

  // WebSocket server for hot reload
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("  WebSocket client connected");

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // Handle WebSocket upgrade for /ws path
  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url || "", `http://localhost:${port}`);
    if (reqUrl.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Watch template file for hot reload
  vite.watcher.add(templatePath);
  vite.watcher.on("change", (changedPath) => {
    if (changedPath === templatePath) {
      console.log("  Template changed, notifying clients...");
      const message = JSON.stringify({ type: "reload" });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  });

  server.listen(port, () => {
    console.log(`\n  SuperImg dev server running at ${url}\n`);
    console.log(`  Template: ${templatePath}\n`);
  });

  if (options.open) {
    // Open browser (cross-platform)
    const command =
      process.platform === "win32"
        ? `start ${url}`
        : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;
    execAsync(command).catch(() => {
      // Ignore errors - browser might not open but server is running
    });
  }

  // Keep process alive and handle shutdown
  process.on("SIGINT", async () => {
    console.log("\n  Shutting down dev server...\n");
    wss.close();
    await vite.close();
    server.close();
    process.exit(0);
  });
}
