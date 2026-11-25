import { execFile as execFileCb, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { Fill, Frame, Html, Stack, Text, image, video, googleFont } from "@foxworth/superimg";
import { doctor, isSuperImgError, render, renderResponse, setup, shutdown } from "@foxworth/superimg/runtime";
import { renderToHtml } from "@foxworth/superimg/runtime/html";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const integrationRoot = join(here, "..");
const fixturePath = join(here, "fixtures", "typed-data.ts");
const indexUrl = pathToFileURL(join(repoRoot, "packages", "superimg", "dist", "index.js")).href;
const runtimeUrl = pathToFileURL(join(repoRoot, "packages", "superimg", "dist", "runtime.node.js")).href;
const cliPath = join(repoRoot, "packages", "superimg-cli", "dist", "cli.js");

const AUTHORED = { width: 320, height: 180 };
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const encoderMp4 = (await doctor()).encoders.mp4;

type ChildResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  elapsedMs: number;
};

type CommandDiagnostics = {
  kind: "superimg-command-diagnostics";
  profile: {
    kind: string;
    counts: Record<string, number>;
    spans: { stage: string; status: string; origin: string }[];
  };
};

function readCommandDiagnostics(stderr: string): CommandDiagnostics[] {
  return stderr.split("\n").flatMap((line) => {
    try {
      const value = JSON.parse(line) as CommandDiagnostics;
      return value.kind === "superimg-command-diagnostics" ? [value] : [];
    } catch {
      return [];
    }
  });
}

function runProfiledCheck(template: string) {
  return execFile(process.execPath, [cliPath, "check", template, "--json", "--profile"], {
    cwd: repoRoot,
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: "1" },
  }).then(
    (result) => ({ code: 0, stdout: result.stdout, stderr: result.stderr }),
    (error: { code?: number | string; stdout?: string; stderr?: string }) => ({
      code: typeof error.code === "number" ? error.code : -1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }),
  );
}

function card() {
  return image({
    size: AUTHORED,
    fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
    sample: { title: "Hi" },
    render(ctx) {
      return Frame(
        { width: "fill", height: "fill" },
        Fill({ color: "#F4F1EA" }),
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center" },
          Text({ variant: "display", color: "#111827" }, ctx.data.title),
        ),
      );
    },
  });
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function runNode(script: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        elapsedMs: Date.now() - started,
      });
    });
  });
}

const renderPngScript = `
import { Fill, Frame, Stack, Text, googleFont, image } from ${JSON.stringify(indexUrl)};
import { render } from ${JSON.stringify(runtimeUrl)};
const card = image({
  size: { width: ${AUTHORED.width}, height: ${AUTHORED.height} },
  fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
  sample: { title: "Hi" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Fill({ color: "#F4F1EA" }),
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ variant: "display", color: "#111827" }, ctx.data.title),
      ),
    );
  },
});
await render(card, { as: "png", data: { title: "Hi" } });
console.log("OK");
`;

const missingChromiumScript = `
import { Fill, Frame, Html, image } from ${JSON.stringify(indexUrl)};
import { render } from ${JSON.stringify(runtimeUrl)};
const card = image({
  size: { width: 64, height: 64 },
  render() {
    return Frame(
      { width: 64, height: 64 },
      Fill({ color: "#F4F1EA" }),
      Html({ width: 64, height: 64, html: "<div id='force-chromium' style='color:#111827'>x</div>" }),
    );
  },
});
try {
  await render(card, { as: "png" });
  console.log(JSON.stringify({ code: null, installCommand: null }));
} catch (error) {
  const caught = error;
  const details = caught && typeof caught === "object" ? caught.details : undefined;
  console.log(JSON.stringify({
    code: caught && typeof caught === "object" ? caught.code ?? null : null,
    installCommand: caught && typeof caught === "object"
      ? caught.installCommand ?? details?.installCommand ?? null
      : null,
  }));
}
`;

describe("superimg runtime as a library", () => {
  let emptyBrowsers: string | undefined;

  afterAll(async () => {
    await shutdown();
    if (emptyBrowsers !== undefined) {
      await rm(emptyBrowsers, { recursive: true, force: true });
    }
  });

  it("renders a png with no init()", async () => {
    const result = await render(card(), { as: "png", data: { title: "Hi" } });
    const bytes = await result.bytes();
    const blob = await result.blob();
    let textError: unknown;
    try {
      await result.text();
      textError = undefined;
    } catch (error) {
      textError = error;
    }
    const size = pngSize(bytes);

    expect.soft(result.mimeType).toBe("image/png");
    expect.soft([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect.soft(size).toEqual(AUTHORED);
    expect.soft(blob.type).toBe("image/png");
    expect.soft(isSuperImgError(textError, "NOT_TEXT")).toBe(true);
  });

  it.skipIf(encoderMp4 === false)("skipped when doctor encoders.mp4 === false; otherwise mp4 has ftyp", async () => {
    const clip = video({
      duration: "1s",
      size: AUTHORED,
      background: "#12100E",
      fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
      sample: { title: "Hi" },
      render(ctx) {
        return Frame(
          { width: "fill", height: "fill" },
          Stack(
            { width: "fill", height: "fill", align: "center", justify: "center" },
            Text({ variant: "display", color: "#F4EFE4" }, ctx.data.title),
          ),
        );
      },
    });
    const result = await render(clip, { as: "mp4" }).catch((error: unknown) => {
      const findings = error !== null && typeof error === "object" && "findings" in error
        ? error.findings
        : undefined;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message} findings=${JSON.stringify(findings)}`, { cause: error });
    });
    const bytes = await result.bytes();
    const head = Buffer.from(bytes.subarray(0, 32)).toString("latin1");

    expect(head).toContain("ftyp");
    expect(result.byteLength).toBeGreaterThan(1000);
  });

  it("renderResponse returns png headers and a quoted sha256 etag", async () => {
    const response = await renderResponse(card(), { as: "png", data: { title: "Hi" } });
    const body = new Uint8Array(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(body).digest("hex");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(body.byteLength));
    expect(response.headers.get("etag")).toBe(`"${sha256}"`);
  });

  it("exits on its own after one png render", async () => {
    const result = await runNode(renderPngScript, process.env, 15_000);

    expect(result.timedOut, `elapsed ${result.elapsedMs}ms\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(false);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim(), result.stderr).toBe("OK");
    expect(result.elapsedMs).toBeLessThanOrEqual(15_000);
  });

  it("reports CHROMIUM_MISSING when the browsers path is an empty repo dir", async () => {
    emptyBrowsers = await mkdtemp(join(repoRoot, "tests/integration/.e2e-browsers-"));
    const result = await runNode(missingChromiumScript, {
      ...process.env,
      SUPERIMG_BROWSERS_PATH: emptyBrowsers,
    }, 30_000);
    let parsed: { code?: unknown; installCommand?: unknown } = {};
    try {
      parsed = JSON.parse(result.stdout) as { code?: unknown; installCommand?: unknown };
    } catch {
      parsed = {};
    }

    expect(parsed.code, `exit ${result.code} timedOut ${result.timedOut}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe("CHROMIUM_MISSING");
    expect(String(parsed.installCommand), result.stdout).toContain("superimg setup");
  });

  it("doctor reports a usable chromium runtime", async () => {
    const report = await doctor();

    expect(report.ok).toBe(true);
    expect(report.chromium.status).toBe("ok");
    expect(setup).toBeTypeOf("function");
  });

  it("profiles one actual CLI check dispatch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-runtime-check-profile-"));
    try {
      await writeFile(join(directory, "package.json"), '{"type":"module"}');
      const source = join(directory, "profile.media.ts");
      await writeFile(source, `
        import { image, Fill, Frame, Text } from "@foxworth/superimg";
        export default image({
          size: { width: 320, height: 180 },
          render: () => Frame(
            { width: 320, height: 180 },
            Fill({ color: "#F4F1EA" }),
            Text({ x: 24, y: 48, size: 40, color: "#111827" }, "Profile check"),
          ),
        });
      `);
      const result = await runProfiledCheck(source);
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
      const records = readCommandDiagnostics(result.stderr);
      expect(records, result.stderr).toHaveLength(1);
      expect(records[0]?.profile).toMatchObject({
        kind: "check",
        counts: { "runtime.check": 1, "runtime.prepare": 1, "source.bundle": 1, "source.materialize": 1 },
      });
      expect(records[0]?.profile.spans.filter((span) => span.stage === "runtime.check")).toEqual([
        expect.objectContaining({ status: "completed", origin: "command" }),
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains CLI profile diagnostics when the requested source path is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-runtime-check-missing-"));
    try {
      const result = await runProfiledCheck(join(directory, "missing.media.ts"));
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({ error: { code: "IO_ERROR" } });
      const records = readCommandDiagnostics(result.stderr);
      expect(records, result.stderr).toHaveLength(1);
      expect(records[0]?.profile).toMatchObject({ kind: "check", counts: { "command.load": 1 } });
      expect(records[0]?.profile.counts["runtime.check"]).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("renderToHtml includes the title", () => {
    const html = renderToHtml({ media: card(), data: { title: "Hi" } });

    expect(html).toContain("Hi");
  });

  it("rejects wrong data keys and types at compile time", async () => {
    const tsconfigDir = await mkdtemp(join(tmpdir(), "superimg-typed-data-"));
    const tsconfigPath = join(tsconfigDir, "tsconfig.json");
    await writeFile(tsconfigPath, JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        skipLibCheck: true,
        noEmit: true,
        types: [],
      },
      files: [fixturePath],
    }));
    const result = await execFile("npx", ["--no-install", "tsc", "--noEmit", "-p", tsconfigPath], {
      cwd: integrationRoot,
    }).then(
      (stdout) => ({ code: 0, stdout: stdout.stdout, stderr: stdout.stderr }),
      (error: { code?: number; stdout?: string; stderr?: string }) => ({
        code: typeof error.code === "number" ? error.code : 1,
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
      }),
    );
    await rm(tsconfigDir, { recursive: true, force: true });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
