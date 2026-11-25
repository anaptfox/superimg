import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCommand, runCheck } from "./check.js";
import { compileCommand, runCompile } from "./compile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const HELLO_WORLD_PATH = join(REPO_ROOT, "examples/basics/hello-world/hello-world.media.ts");

const originalCwd = process.cwd();
const roots: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createTemplate(name: string, contents: string): Promise<{ root: string; path: string }> {
  const root = await mkdtemp(join(tmpdir(), "superimg-native-target-"));
  roots.push(root);
  process.chdir(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  const path = join(root, `${name}.media.ts`);
  await writeFile(path, contents);
  return { root, path };
}

describe("--target native check and compile", { concurrent: false }, () => {
  it("passes native portability check and compile for hello-world.media.ts", async () => {
    const outRoot = await mkdtemp(join(tmpdir(), "superimg-native-compile-ok-"));
    roots.push(outRoot);
    const outDir = join(outRoot, "hello-world.superimg");

    const checkReport = await runCheck(HELLO_WORLD_PATH, { target: "native" });
    expect(checkReport.ok).toBe(true);
    expect(checkReport.issues.some((issue) => issue.code === "NATIVE_UNPORTABLE")).toBe(false);

    const compileReport = await runCompile(HELLO_WORLD_PATH, {
      target: "native",
      output: outDir,
      json: true,
    });
    expect(compileReport.ok).toBe(true);
    expect(compileReport.target).toBe("native");
    expect(compileReport.nativePortable).toBe(true);
    expect(existsSync(join(outDir, "media.json"))).toBe(true);

    const mediaIr = JSON.parse(await readFile(join(outDir, "media.json"), "utf8")) as {
      extensions?: Record<string, { schemaVersion?: number; payload?: unknown }>;
    };
    expect(mediaIr.extensions?.["superimg.native"]).toEqual({
      schemaVersion: 0,
      payload: { portable: true, reasons: [] },
    });
  }, 30_000);

  it("fails --target native check and compile when a template uses Html()", async () => {
    const { root, path } = await createTemplate("html-box", `
      import { video, Frame, Fill, Html } from "@foxworth/superimg";
      export default video({
        duration: "0.2s",
        fps: 10,
        size: { width: 320, height: 180 },
        render() {
          return Frame(
            { id: "stage", width: "fill", height: "fill" },
            Fill({ id: "bg", color: "#111827" }),
            Html({ id: "embed-box", width: 200, height: 80, html: "<p>Web only</p>" }),
          );
        },
      });
    `);

    const webReport = await runCheck(path, { target: "web" });
    expect(webReport.issues.some((issue) => issue.code === "NATIVE_UNPORTABLE")).toBe(false);

    const nativeReport = await runCheck(path, { target: "native" });
    expect(nativeReport.ok).toBe(false);
    expect(nativeReport.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "NATIVE_UNPORTABLE",
        nodeId: "embed-box",
        frame: 0,
        suggestion: expect.stringContaining("Html"),
      }),
    );

    const outDir = join(root, "output", "html-box.superimg");
    await expect(
      runCompile(path, { target: "native", output: outDir, json: true }),
    ).rejects.toMatchObject({
      code: "NATIVE_UNPORTABLE",
      message: expect.stringMatching(/#embed-box.*Html/),
      details: expect.objectContaining({
        target: "native",
        portable: false,
        reasons: expect.arrayContaining([
          expect.objectContaining({ nodeId: "embed-box", reason: "Html" }),
        ]),
      }),
    });
    expect(existsSync(outDir)).toBe(false);
  }, 30_000);

  it("fails --target native check and compile when a template uses inlineCss or unsupported style:*", async () => {
    const { root, path } = await createTemplate("inline-css", `
      import { image, Frame, Fill, Text } from "@foxworth/superimg";
      export default image({
        size: { width: 320, height: 180 },
        inlineCss: ["body { letter-spacing: 0.05em; }"],
        render() {
          return Frame(
            { id: "stage", width: "fill", height: "fill" },
            Fill({ id: "bg", color: "#111827" }),
            Frame(
              { id: "shadow-card", width: 200, height: 80, style: { boxShadow: "0 4px 12px #000" } },
              Text({ id: "label", color: "#f8fafc" }, "Styled"),
            ),
          );
        },
      });
    `);

    const stdoutChunks: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => {
      stdoutChunks.push(String(value));
    });
    await checkCommand(path, { target: "native" });
    expect(process.exitCode).toBe(1);
    const cliReport = JSON.parse(stdoutChunks.at(-1)!);
    expect(cliReport.ok).toBe(false);
    expect(cliReport.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "NATIVE_UNPORTABLE",
        frame: 0,
        details: expect.objectContaining({ target: "native", reason: "inlineCss" }),
      }),
    );
    expect(cliReport.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "NATIVE_UNPORTABLE",
        nodeId: "shadow-card",
        frame: 0,
        details: expect.objectContaining({ target: "native", reason: "style:boxShadow" }),
      }),
    );

    const outDir = join(root, "output", "inline-css.superimg");
    const compileStdout: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      compileStdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`);
    }) as never);

    await expect(
      compileCommand(path, { target: "native", output: outDir, json: true }),
    ).rejects.toThrow("EXIT:1");
    expect(existsSync(outDir)).toBe(false);
    const errorPayload = JSON.parse(compileStdout.at(-1)!);
    expect(errorPayload).toMatchObject({
      schemaVersion: 0,
      ok: false,
      error: {
        code: "NATIVE_UNPORTABLE",
        details: {
          target: "native",
          portable: false,
          reasons: expect.arrayContaining([
            expect.objectContaining({ reason: "inlineCss" }),
            expect.objectContaining({ nodeId: "shadow-card", reason: "style:boxShadow" }),
          ]),
        },
      },
    });
  }, 30_000);

  it("rejects unknown --target values", async () => {
    await expect(
      runCheck(HELLO_WORLD_PATH, { target: "ios" as "web" }),
    ).rejects.toMatchObject({ code: "INVALID_TARGET" });

    await expect(
      runCompile(HELLO_WORLD_PATH, { target: "ios" as "web" }),
    ).rejects.toMatchObject({ code: "INVALID_TARGET" });
  }, 30_000);
});
