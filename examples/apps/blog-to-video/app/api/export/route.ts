import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateKaraokeDuration, type KaraokeData } from "@/lib/template";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..", "..", "..");

const FORMATS = ["horizontal", "vertical", "square"] as const;
type Format = (typeof FORMATS)[number];

// Rendering happens in a standalone `tsx` child process rather than an in-process
// `import("superimg/server")` — Turbopack cannot externalize a pnpm workspace symlink
// like `superimg` (https://github.com/vercel/next.js/issues/84388) and fails tracing
// into its bundled Playwright/oxc-parser internals if imported directly in this route.
function renderInChildProcess(input: { data: KaraokeData; format: Format; duration: number }) {
  return new Promise<Buffer>((resolvePromise, reject) => {
    const child = spawn(
      "npx",
      ["tsx", resolve(APP_ROOT, "scripts", "render.ts")],
      { cwd: APP_ROOT, stdio: ["pipe", "pipe", "pipe"] },
    );

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf-8") || `render exited with code ${code}`));
        return;
      }
      resolvePromise(Buffer.concat(stdout));
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

export async function POST(req: Request) {
  const { data, format } = (await req.json()) as {
    data?: KaraokeData;
    format?: Format;
  };

  if (!data || !format || !FORMATS.includes(format)) {
    return Response.json({ error: "data and format are required" }, { status: 400 });
  }

  try {
    const video = await renderInChildProcess({
      data,
      format,
      duration: calculateKaraokeDuration(data),
    });

    return new Response(new Uint8Array(video), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="blog-readalong.mp4"',
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 },
    );
  }
}
