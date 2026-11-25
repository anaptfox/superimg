import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { profileStage } from "../utils/command-profile.js";
import { check as runtimeCheck } from "@superimg/core/runtime";
import { loadCliMediaValue, prepareCliMediaSource } from "../utils/runtime-source.js";
import { checkCommand } from "./check.js";

vi.mock("../utils/command-profile.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils/command-profile.js")>();
  return { ...original, profileStage: vi.fn(original.profileStage) };
});
vi.mock("@superimg/core/runtime", async (importOriginal) => {
  const original = await importOriginal<typeof import("@superimg/core/runtime")>();
  return { ...original, check: vi.fn(original.check) };
});
vi.mock("../utils/runtime-source.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils/runtime-source.js")>();
  return { ...original, loadCliMediaValue: vi.fn(original.loadCliMediaValue), prepareCliMediaSource: vi.fn(original.prepareCliMediaSource) };
});

const originalCwd = process.cwd();
const roots: string[] = [];
afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.mocked(prepareCliMediaSource).mockClear();
  vi.mocked(profileStage).mockClear();
  vi.mocked(runtimeCheck).mockClear();
  vi.mocked(loadCliMediaValue).mockClear();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

it("compiles once and keeps canonical check, source findings and captures on the command's loaded revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-check-revision-"));
  roots.push(root);
  process.chdir(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  const helper = join(root, "label.ts");
  await writeFile(helper, 'export const label = "original-helper";');
  const entry = join(root, "clock.media.ts");
  const originalEntry = [
    'import { video, Html } from "@foxworth/superimg";',
    'import { label } from "./label";',
    'export default video({ duration: "1s", fps: 10, size: { width: 320, height: 180 },',
    '  resolve: () => ({ duration: 1 }),',
    '  render: ctx => Html({ width: "fill", height: "fill", html: `<p>${label}</p><span>${ctx.globalTimeSeconds}</span>` }),',
    '});',
  ].join("\n");
  await writeFile(entry, originalEntry);
  const original = await vi.importActual<typeof import("../utils/runtime-source.js")>("../utils/runtime-source.js");
  let loadedValue: unknown;
  const resolutions = vi.fn();
  vi.mocked(loadCliMediaValue).mockImplementationOnce(async (...args) => {
    const loaded = await original.loadCliMediaValue(...args);
    if (loaded.value.kind !== "media") throw Error("Expected media fixture");
    const authoredResolve = loaded.value.resolve!;
    const value = { ...loaded.value, resolve: (...resolveArgs: Parameters<typeof authoredResolve>) => {
      resolutions();
      return authoredResolve(...resolveArgs);
    } };
    loadedValue = value;
    await writeFile(helper, 'export const label = "new-helper";');
    await writeFile(entry, originalEntry.replace('${ctx.globalTimeSeconds}', 'new-entry'));
    return { ...loaded, value };
  });
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation(value => output.push(String(value)));

  await checkCommand("clock", { at: "0.5" });

  const report = JSON.parse(output.at(-1)!);
  expect(report.error).toBeUndefined();
  expect(report.samples[0].text).toContain("original-helper");
  expect(report.samples[0].text).not.toContain("new-helper");
  expect(report.runtime.findings).toContainEqual(expect.objectContaining({ code: "SCENE_LOCAL_USES_GLOBAL" }));
  expect(vi.mocked(runtimeCheck).mock.calls[0]![1]).toBe(loadedValue);
  expect(prepareCliMediaSource).toHaveBeenCalledTimes(1);
  // The public compiler reports this stage around actual bundle construction,
  // including any accidental recompilation during source loading.
  expect(vi.mocked(profileStage).mock.calls.filter(([stage]) => stage === "source.bundle")).toHaveLength(1);
  expect(resolutions).toHaveBeenCalledTimes(1);
}, 20_000);
