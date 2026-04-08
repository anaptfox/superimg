//! Dev server command - static dev-ui + API + WebSocket

import { createServer as createHttpServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import chokidar from "chokidar";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos } from "../utils/discover-videos.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { parseTemplate } from "../utils/template-config.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";
import { bundleTemplate, bundleTemplateESM } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";

const execAsync = promisify(exec);

interface DevOptions {
  template?: string;
  port: string;
  open: boolean;
}

export async function devCommand(template: string | undefined, options: DevOptions) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const devRoot = join(__dirname, "dev-ui");
  const port = parseInt(options.port, 10);

  const homeMode = !template || template.trim() === "";

  if (homeMode) {
    await runHomeMode(port, devRoot, options.open);
  } else {
    await runSingleVideoMode(template!, port, devRoot, options.open);
  }
}

async function runHomeMode(port: number, devRoot: string, open: boolean) {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const videos = discoverVideos(projectRoot);
  const url = `http://localhost:${port}`;

  const server = createHttpServer(async (req, res) => {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0];

    if (pathname === "/api/videos") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      const list = videos.map((v) => ({
        name: v.name,
        shortName: v.shortName,
        relativePath: v.relativePath,
        hasLocalConfig: v.hasLocalConfig,
      }));
      res.end(JSON.stringify(list));
      return;
    }

    const videosMatch = pathname.match(/^\/api\/videos\/(.+)\/(template|config)$/);
    if (videosMatch) {
      const name = decodeURIComponent(videosMatch[1]);
      const type = videosMatch[2];
      const video = videos.find((v) => v.name === name);
      if (!video) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Video not found" }));
        return;
      }
      if (type === "template") {
        try {
          const esm = await bundleTemplateESM(video.entrypoint);
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-cache");
          res.end(esm);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      } else {
        try {
          const cascadingConfig = await loadCascadingConfig(video.entrypoint, projectRoot);
          const parsed = await parseTemplate(video.entrypoint, { cascadingConfig });
          const resolved = parsed.config;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              width: resolved.width,
              height: resolved.height,
              fps: resolved.fps,
              duration: resolved.duration,
              outputs: parsed.templateConfig?.outputs,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
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

  server.listen(port, () => {
    console.log(`\n  SuperImg dev server running at ${url}\n`);
    console.log(`  Home: ${videos.length} video(s) discovered\n`);
  });

  if (open) {
    const command =
      process.platform === "win32"
        ? `start ${url}`
        : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;
    execAsync(command).catch(() => {});
  }

  const cleanup = () => {
    console.log("\n  Shutting down dev server...\n");
    server.closeAllConnections();
    server.close();
    process.exit(0);
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

async function runSingleVideoMode(
  template: string,
  port: number,
  devRoot: string,
  open: boolean
) {
  let templatePath: string;
  try {
    templatePath = resolveTemplatePath(template);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
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
    const cascadingConfig = await loadCascadingConfig(templatePath, projectRoot);
    const parsed = await parseTemplate(templatePath, { cascadingConfig });
    const resolved = parsed.config;
    const outputs = parsed.templateConfig?.outputs;
    const audio = parsed.templateConfig?.audio;
    return {
      width: resolved.width,
      height: resolved.height,
      fps: resolved.fps,
      duration: resolved.duration,
      outputs,
      audio,
      templateDir: dirname(templatePath),
    };
  }

  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  const watcher = chokidar.watch(templatePath, { ignoreInitial: true });
  watcher.on("change", () => {
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
        res.end(JSON.stringify(config));
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

    // Serve assets (audio, images) relative to template directory
    if (pathname === "/api/assets") {
      const url = new URL(reqUrl, `http://localhost:${port}`);
      const relativePath = url.searchParams.get("path");
      if (!relativePath) {
        res.statusCode = 400;
        res.end("Missing path parameter");
        return;
      }
      const templateDir = dirname(templatePath);
      const assetPath = join(templateDir, relativePath);

      if (!existsSync(assetPath)) {
        res.statusCode = 404;
        res.end("Asset not found");
        return;
      }

      const content = readFileSync(assetPath);
      const ext = assetPath.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        aac: "audio/aac",
        flac: "audio/flac",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
      };
      res.setHeader("Content-Type", mimeTypes[ext ?? ""] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(content);
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

  if (open) {
    const command =
      process.platform === "win32"
        ? `start ${url}`
        : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;
    execAsync(command).catch(() => {});
  }

  const cleanup = () => {
    console.log("\n  Shutting down dev server...\n");
    watcher.close();
    wss.close();
    server.closeAllConnections();
    server.close();
    process.exit(0);
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}
