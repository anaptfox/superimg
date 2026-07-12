import { createFileRoute } from "@tanstack/react-router";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateTimelineDuration, type TimelineData } from "#/lib/template";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..", "..", "..");

// Rendering happens in a standalone `tsx` child process rather than an in-process
// `import("superimg/server")` — see scripts/render.ts for why.
function renderInChildProcess(input: { data: TimelineData; duration: number }) {
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

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { data } = (await request.json()) as { data?: TimelineData };

        if (!data) {
          return Response.json({ error: "data is required" }, { status: 400 });
        }

        try {
          const video = await renderInChildProcess({
            data,
            duration: calculateTimelineDuration(data.events.length),
          });

          return new Response(new Uint8Array(video), {
            headers: {
              "Content-Type": "video/mp4",
              "Content-Disposition": 'attachment; filename="timeline.mp4"',
            },
          });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Render failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
