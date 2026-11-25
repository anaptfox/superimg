import { execFile as execFileCallback } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { rolldown } from "rolldown";
import { directVideoBytes } from "../../fixtures/composition/direct-video.js";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const execFile = promisify(execFileCallback);

export async function startFixture(fixtureName: string): Promise<{ origin: string; bundle: string; close(): Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "superimg-browser-inspection-"));
  let server: Server | undefined;
  try {
    const bundle = join(root, "app.js");
    const build = await rolldown({ input: join(repoRoot, "tests/integration/fixtures/inspection", fixtureName), platform: "browser" });
    try { await build.write({ file: bundle, format: "esm", codeSplitting: false }); }
    finally { await build.close(); }
    await writeFile(join(root, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><title>SuperImg native inspection acceptance</title><style>body{margin:0;background:#f8fafc;font:16px system-ui}#primary,#secondary{width:320px;height:180px}#secondary{position:absolute;left:340px;top:0}#travel{height:2400px}#primary{width:min(320px,100vw);position:sticky;top:0}#controls{position:fixed;right:12px;top:200px;z-index:9}</style></head><body><section id="travel"><div id="primary"></div><div id="secondary"></div></section><div id="controls"></div><script>addEventListener('error',event=>{if(document.body.dataset.ready===undefined){document.body.dataset.ready='error';document.body.dataset.error=event.message}});addEventListener('unhandledrejection',event=>{if(document.body.dataset.ready===undefined){document.body.dataset.ready='error';document.body.dataset.error=String(event.reason)}})</script><script type="module" src="/app.js"></script></body></html>`);
    const imageBytes = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#22c55e" } }).png().toBuffer();
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;
      if (path.startsWith("/asset.")) {
        response.setHeader("cache-control", "no-store");
        const delay = Math.min(5000, Math.max(0, Number(url.searchParams.get("delay") ?? 0)));
        const timer = setTimeout(() => {
          if (url.searchParams.get("fail") === "1") { response.statusCode = 404; response.end("Intentional resource failure"); return; }
          const contentType = path.endsWith(".png") ? "image/png" : path.endsWith(".mp4") ? "video/mp4" : path.endsWith(".css") ? "text/css" : "font/ttf";
          response.setHeader("content-type", contentType);
          if (path.endsWith(".png")) response.end(imageBytes);
          else if (path.endsWith(".mp4")) response.end(directVideoBytes);
          else if (path.endsWith(".css")) response.end(`@font-face{font-family:Fixture;src:url('/asset.ttf?delay=1000&frame=${url.searchParams.get("frame") ?? "0"}')}#resource-text{font:20px Fixture}`);
          else void readFile(join(repoRoot, "packages/superimg-core/assets/fonts/Inter-400.ttf")).then((bytes) => response.end(bytes));
        }, delay);
        response.once("close", () => clearTimeout(timer));
        return;
      }
      const file = path === "/app.js" ? "app.js" : "index.html";
      response.setHeader("content-type", file === "app.js" ? "text/javascript" : "text/html");
      void readFile(join(root, file)).then((bytes) => response.end(bytes), (error) => { response.statusCode = 500; response.end(String(error)); });
    });
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback TCP server");
    return {
      origin: `http://127.0.0.1:${address.port}`, bundle,
      async close() { await new Promise<void>((resolve) => server!.close(() => resolve())); await rm(root, { recursive: true, force: true }); },
    };
  } catch (error) {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** Build and serve the user-facing example through its ordinary public Vite entry. */
export async function startBuiltExample(): Promise<{ origin: string; files: string[]; root: string; close(): Promise<void> }> {
  await execFile("pnpm", ["--filter", "superimg-example-agent-inspection", "build"], { cwd: repoRoot, timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
  const root = resolve(repoRoot, "examples/apps/agent-inspection/dist");
  const files = (await readdir(root, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const path = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) { response.statusCode = 404; response.end(); return; }
    response.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html");
    void readFile(path).then((bytes) => response.end(bytes), () => { response.statusCode = 404; response.end(); });
  });
  await new Promise<void>((resolveReady, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveReady); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected example loopback server");
  return { origin: `http://127.0.0.1:${address.port}`, files, root, async close() { await new Promise<void>((resolveClosed) => server.close(() => resolveClosed())); } };
}
