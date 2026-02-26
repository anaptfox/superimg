//! Dev server command - static dev-ui + API + WebSocket

import { createServer as createHttpServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, watch } from "node:fs";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";
import { bundleTemplate, bundleTemplateESM } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";

const execAsync = promisify(exec);

interface DevOptions {
  template: string;
  port: string;
  open: boolean;
}

export async function devCommand(template: string, options: DevOptions) {
  let templatePath: string;
  try {
    templatePath = resolveTemplatePath(template);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const devRoot = join(__dirname, "dev-ui");

  const port = parseInt(options.port, 10);
  const url = `http://localhost:${port}?template=/api/template`;

  let bundleCache: { iife: string; esm: string } | null = null;

  async function getBundle() {
    if (!bundleCache) {
      const [iife, esm] = await Promise.all([
        bundleTemplate(templatePath),
        bundleTemplateESM(templatePath),
      ]);
      bundleCache = { iife, esm };
    }
    return bundleCache;
  }

  async function loadTemplateConfig() {
    const { iife } = await getBundle();
    const result = compileTemplate(iife);
    if (result.error) throw new Error(result.error.message);
    return result.template?.config ?? {};
  }

  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  watch(templatePath, () => {
    bundleCache = null;
    console.log("  Template changed, notifying clients...");
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: "reload" }));
    }
  });

  const server = createHttpServer(async (req, res) => {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];

    if (pathname === "/api/config") {
      try {
        const config = await loadTemplateConfig();
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            width: config.width ?? 1920,
            height: config.height ?? 1080,
            fps: config.fps ?? 60,
            durationSeconds: config.durationSeconds ?? 5,
            outputs: config.outputs,
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (pathname === "/api/template") {
      try {
        const { esm } = await getBundle();
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-cache");
        res.end(esm);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(String(err));
      }
      return;
    }

    if (pathname === "/ws") {
      return;
    }

    const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const filePath = join(devRoot, safePath);
    if (!existsSync(filePath)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const content = readFileSync(filePath);
    const ext = filePath.split(".").pop();
    const types: Record<string, string> = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
    };
    res.setHeader("Content-Type", types[ext ?? ""] ?? "application/octet-stream");
    res.end(content);
  });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url || "", `http://localhost:${port}`);
    if (reqUrl.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`\n  SuperImg dev server running at ${url}\n`);
    console.log(`  Template: ${templatePath}\n`);
  });

  if (options.open) {
    const command =
      process.platform === "win32"
        ? `start ${url}`
        : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;
    execAsync(command).catch(() => {});
  }

  process.on("SIGINT", () => {
    console.log("\n  Shutting down dev server...\n");
    wss.close();
    server.close();
    process.exit(0);
  });
}
