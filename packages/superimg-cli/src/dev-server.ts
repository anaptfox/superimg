//! Pure library function for starting the SuperImg dev server without side-effects.

import { createServer as createHttpServer, type ServerResponse, type Server } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import chokidar from "chokidar";
import { WebSocketServer, WebSocket } from "ws";
import { resolveTemplatePath } from "./cli/utils/resolve-template.js";
import { findProjectRoot } from "./cli/utils/find-project-root.js";
import { discoverVideos } from "./cli/utils/discover-videos.js";
import { loadCascadingConfig } from "./cli/utils/config-loader.js";
import { parseTemplate } from "./cli/utils/template-config.js";
import {
  bundleTemplate,
  bundleTemplateESM,
  bundleTemplateESMWithMap,
} from "@superimg/core/bundler";
import { formatError } from "@superimg/core/errors";
import type { TemplateBundle } from "@superimg/types";

export interface DevServerOptions {
  port?: number;
  signal?: AbortSignal;
}

export interface DevServer {
  url: string;
  close(): Promise<void>;
}

export async function startDevServer(
  template: string | undefined,
  options?: DevServerOptions
): Promise<DevServer> {
  const devRoot = join(dirname(fileURLToPath(import.meta.url)), "dev-ui");
  const port = options?.port ?? 4747;
  const homeMode = !template || template.trim() === "";

  const server = homeMode
    ? await startHomeMode(port, devRoot)
    : await startSingleVideoMode(template!, port, devRoot);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => server.close(), { once: true });
  }

  return server;
}

async function startHomeMode(port: number, devRoot: string): Promise<DevServer> {
  const projectRoot = findProjectRoot();
  const videos = discoverVideos(projectRoot);
  const url = `http://localhost:${port}`;

  const server = createHttpServer(async (req, res) => {
    const pathname = (req.url || "/").split("?")[0] ?? "/";

    if (pathname === "/api/videos") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.end(
        JSON.stringify(
          videos.map((v) => ({
            name: v.name,
            shortName: v.shortName,
            relativePath: v.relativePath,
            hasLocalConfig: v.hasLocalConfig,
          }))
        )
      );
      return;
    }

    const videosMatch = pathname.match(/^\/api\/videos\/(.+)\/(template-bundle|template|config)$/);
    if (videosMatch) {
      const name = decodeURIComponent(videosMatch[1] ?? "");
      const type = videosMatch[2];
      const video = videos.find((v) => v.name === name);
      if (!video) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Video not found" }));
        return;
      }
      if (type === "template") {
        try {
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-cache");
          res.end(await bundleTemplateESM(video.entrypoint));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: formatError(err).json }));
        }
      } else if (type === "template-bundle") {
        try {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify(await bundleTemplateESMWithMap(video.entrypoint)));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: formatError(err).json }));
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

    if (pathname === "/ws") return;
    serveStaticFile(pathname, devRoot, res);
  });

  await listen(server, port);

  return {
    url,
    close: async () => {
      server.closeAllConnections();
      await closeServer(server);
    },
  };
}

async function startSingleVideoMode(template: string, port: number, devRoot: string): Promise<DevServer> {
  const templatePath = resolveTemplatePath(template);
  const projectRoot = findProjectRoot();
  const url = `http://localhost:${port}?template=/api/template`;

  let bundleCache: { iife: string; esm: TemplateBundle } | null = null;

  async function getBundle() {
    if (!bundleCache) {
      const [iife, esm] = await Promise.all([
        bundleTemplate(templatePath),
        bundleTemplateESMWithMap(templatePath),
      ]);
      bundleCache = { iife, esm };
    }
    return bundleCache;
  }

  async function loadTemplateConfig() {
    const cascadingConfig = await loadCascadingConfig(templatePath, projectRoot);
    const parsed = await parseTemplate(templatePath, { cascadingConfig });
    const resolved = parsed.config;
    return {
      width: resolved.width,
      height: resolved.height,
      fps: resolved.fps,
      duration: resolved.duration,
      outputs: parsed.templateConfig?.outputs,
      audio: parsed.templateConfig?.audio,
      templateDir: dirname(templatePath),
    };
  }

  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  // Collect _config.ts files from template dir up to project root so config
  // changes also trigger a reload (mirroring the loadCascadingConfig walk).
  const configsToWatch: string[] = [];
  {
    let dir = dirname(templatePath);
    while (dir && dir.length >= projectRoot.length) {
      const cp = join(dir, "_config.ts");
      if (existsSync(cp)) configsToWatch.push(cp);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  const watcher = chokidar.watch([templatePath, ...configsToWatch], { ignoreInitial: true });
  watcher.on("change", () => {
    bundleCache = null;
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: "reload" }));
    }
  });

  const server = createHttpServer(async (req, res) => {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0] ?? "/";

    if (pathname === "/api/config") {
      try {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await loadTemplateConfig()));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/template") {
      try {
        const { esm } = await getBundle();
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-cache");
        res.end(esm.code);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/template-bundle") {
      try {
        const { esm } = await getBundle();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(JSON.stringify(esm));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/assets") {
      const url = new URL(reqUrl, `http://localhost:${port}`);
      const relativePath = url.searchParams.get("path");
      if (!relativePath) {
        res.statusCode = 400;
        res.end("Missing path parameter");
        return;
      }
      const assetPath = join(dirname(templatePath), relativePath);
      if (!existsSync(assetPath)) {
        res.statusCode = 404;
        res.end("Asset not found");
        return;
      }
      const ext = assetPath.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
        aac: "audio/aac", flac: "audio/flac", png: "image/png", jpg: "image/jpeg",
        jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
      };
      res.setHeader("Content-Type", mimeTypes[ext ?? ""] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(readFileSync(assetPath));
      return;
    }

    if (pathname === "/ws") return;
    serveStaticFile(pathname, devRoot, res);
  });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url || "", `http://localhost:${port}`);
    if (reqUrl.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    } else {
      socket.destroy();
    }
  });

  await listen(server, port);

  return {
    url,
    close: async () => {
      await watcher.close();
      wss.close();
      server.closeAllConnections();
      await closeServer(server);
    },
  };
}

function serveStaticFile(pathname: string, devRoot: string, res: ServerResponse): void {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = join(devRoot, safePath);
  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = filePath.split(".").pop();
  const types: Record<string, string> = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
  };
  res.setHeader("Content-Type", types[ext ?? ""] ?? "application/octet-stream");
  res.end(readFileSync(filePath));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
