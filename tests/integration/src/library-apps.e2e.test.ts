import { spawn, type ChildProcess } from "node:child_process";
import { access, readFile, rm } from "node:fs/promises";
import { createServer, connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GET } from "../../../examples/apps/library-next-og/app/og/route";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const apps = join(repoRoot, "examples", "apps");

type ChildResult = { code: number | null; stdout: string; stderr: string };

function run(command: string, args: string[], cwd: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForPort(port: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, "127.0.0.1");
      const fail = () => {
        socket.destroy();
        if (Date.now() - started > 30_000) reject(new Error(`Port ${port} did not open`));
        else setTimeout(attempt, 200);
      };
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", fail);
    };
    attempt();
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.pid !== undefined) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      }
    }, 5_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, "SIGTERM");
        return;
      } catch {
        // The child is not a process-group leader.
      }
    }
    child.kill("SIGTERM");
  });
}

describe("library example apps", () => {
  it("node mp4 app writes a clip with ftyp", async () => {
    const cwd = join(apps, "library-node-mp4");
    const outDir = join(cwd, "out");
    const clip = join(outDir, "clip.mp4");
    try {
      const result = await run(join(cwd, "node_modules", ".bin", "tsx"), ["render.ts"], cwd);
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
      const bytes = await readFile(clip);
      expect(bytes.subarray(0, 32).toString("latin1")).toContain("ftyp");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 180_000);

  it("next og route returns a 1200x630 png", async () => {
    const response = await GET(new Request("http://x/og?title=Hello"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(bytes.subarray(12, 16)).toString("latin1")).toBe("IHDR");
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
  }, 180_000);

  it("next og app serves a 1200x630 png under turbopack", async () => {
    const cwd = join(apps, "library-next-og");
    const built = await run("pnpm", ["--filter", "superimg-example-library-next-og", "build"], repoRoot);
    expect(built.code, `${built.stdout}\n${built.stderr}`).toBe(0);

    const port = await freePort();
    const child = spawn(join(cwd, "node_modules", ".bin", "next"), ["start", "-p", String(port)], {
      cwd,
      env: process.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const onData = (chunk: Buffer) => { output += chunk.toString("utf8"); };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`next start timed out\n${output}`)), 60_000);
        let settled = false;
        const succeed = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        };
        child.once("error", fail);
        child.once("exit", (code) => fail(new Error(`next start exited ${code}\n${output}`)));
        const watch = () => {
          if (output.includes("Ready")) succeed();
        };
        child.stdout?.on("data", watch);
        child.stderr?.on("data", watch);
      });
      await waitForPort(port);
      const response = await fetch(`http://127.0.0.1:${port}/og?title=Hello`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(response.status, output).toBe(200);
      expect(response.headers.get("content-type"), output).toBe("image/png");
      expect(Buffer.from(bytes.subarray(12, 16)).toString("latin1")).toBe("IHDR");
      expect(view.getUint32(16)).toBe(1200);
      expect(view.getUint32(20)).toBe(630);
    } finally {
      await stopChild(child);
    }
  }, 300_000);

  it("browser webp app builds", async () => {
    const result = await run("pnpm", ["--filter", "superimg-example-library-browser-webp", "build"], repoRoot);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    await access(join(apps, "library-browser-webp", "dist", "index.html"));
  }, 180_000);

  it("react player app builds", async () => {
    const result = await run("pnpm", ["--filter", "superimg-example-react-player", "build"], repoRoot);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 180_000);
});
