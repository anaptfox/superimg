import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CLI_ENTRY = resolve(REPO_ROOT, "packages/superimg-cli/dist/cli.js");
const HELLO_WORLD = resolve(REPO_ROOT, "examples/basics/hello-world/hello-world.media.ts");
const JSC_RUNTIME_BUNDLE = resolve(
  REPO_ROOT,
  "packages/superimg-swift/Sources/SuperImg/Resources/superimg-jsc-runtime.js",
);
const V8_FIXTURE = resolve(
  REPO_ROOT,
  "packages/superimg-swift/Tests/SuperImgTests/ArtifactFixtures/hello-world-v8.json",
);

function createSandboxedNativeRuntime() {
  const code = readFileSync(JSC_RUNTIME_BUNDLE, "utf8");
  const sandbox: Record<string, unknown> = {
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Map,
    Set,
    WeakMap,
    Uint8Array,
    Int32Array,
    DataView,
    ArrayBuffer,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Number,
    String,
    Boolean,
    Symbol,
    Promise,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  runInNewContext(code, sandbox);
  return sandbox.__superimgNative as {
    loadArtifact: (payload: {
      programCode: string;
      media: Record<string, unknown>;
      job: Record<string, unknown>;
    }) => { id: string };
    sampleArtifact: (id: string, req: Record<string, unknown>) => unknown;
    disposeArtifact: (id: string) => void;
  };
}

describe("cross-OS .superimg DisplayList conformance", () => {
  it("compiles hello-world.media.ts with --target native and matches DisplayList v1 across Node V8 and Swift JavaScriptCore", () => {
    const tmp = mkdtempSync(join(tmpdir(), "superimg-cross-os-"));
    const outDir = join(tmp, "hello-world.superimg");
    try {
      const stdout = execFileSync(
        process.execPath,
        [CLI_ENTRY, "compile", HELLO_WORLD, "--target", "native", "-o", outDir, "--json"],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
      const report = JSON.parse(stdout);
      expect(report.ok).toBe(true);
      expect(report.target).toBe("native");
      expect(report.nativePortable).toBe(true);

      const media = JSON.parse(readFileSync(join(outDir, "media.json"), "utf8"));
      expect(media.extensions["superimg.native"]).toEqual({
        schemaVersion: 0,
        payload: { portable: true, reasons: [] },
      });

      const runtime = createSandboxedNativeRuntime();
      const loaded = runtime.loadArtifact({
        programCode: readFileSync(join(outDir, "program.mjs"), "utf8"),
        media,
        job: JSON.parse(readFileSync(join(outDir, "job.json"), "utf8")),
      });

      const patch = { title: "Cross-OS Parity" };
      const snapshots = {
        enter: runtime.sampleArtifact(loaded.id, { seconds: 0.4, data: patch }),
        hold: runtime.sampleArtifact(loaded.id, { seconds: 2.5, data: patch }),
        exit: runtime.sampleArtifact(loaded.id, { seconds: 5.2, data: patch }),
      };
      runtime.disposeArtifact(loaded.id);

      const expected = JSON.parse(readFileSync(V8_FIXTURE, "utf8"));
      expect(snapshots).toEqual(expected);

      // On macOS with Swift installed, prove exact JavaScriptCore <-> V8 parity + PNG + MP4 on this fresh artifact!
      if (process.platform === "darwin") {
        execFileSync(
          "swift",
          [
            "test",
            "--package-path",
            resolve(REPO_ROOT, "packages/superimg-swift"),
            "--filter",
            "CrossOSEndToEndTests",
          ],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              SUPERIMG_CONFORMANCE_ARTIFACT: outDir,
            },
            stdio: "pipe",
          },
        );
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});
