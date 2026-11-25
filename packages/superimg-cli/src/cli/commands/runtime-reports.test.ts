import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCommand } from "./check.js";
import { inspectCommand } from "./inspect.js";

const originalCwd = process.cwd();
const roots: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("CLI canonical runtime reports", { concurrent: false }, () => {
  it("reports source findings through the canonical interaction report", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-cli-source-gate-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(
      join(root, "card.media.ts"),
      [
        'import { image, Html } from "@foxworth/superimg";',
        "const legacyTiming = { for: 30 };",
        "void legacyTiming;",
        "export default image({",
        "  size: { width: 320, height: 180 },",
        '  render: () => Html({ width: "fill", height: "fill", html: "<h1>Card</h1>" }),',
        "});",
      ].join("\n"),
    );
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await checkCommand("card", { summary: true });

    const report = JSON.parse(output.at(-1)!) as {
      ok: boolean;
      issues: Array<{ code: string; severity: string }>;
      runtime: {
        ok: boolean;
        findings: Array<{ category: string; code: string }>;
      };
    };
    expect(report).toMatchObject({ schemaVersion: 1, ok: false, certainty: "completed", error: { code: "CHECK_FAILED" } });
    expect(report.runtime.ok).toBe(false);
    // The Html() still also reports an informational NEEDS_BROWSER finding.
    expect(report.runtime.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      category: "authoring",
      code: "UNITLESS_MOTION_TIME",
    })]));
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "UNITLESS_MOTION_TIME",
      severity: "error",
    }));
    expect(report.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  }, 20_000);

  it("checks a provider collection without executing the provider", async () => {
    const project = await collectionProject("check");
    process.chdir(project.root);
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await checkCommand("cards", { summary: true, entry: [] });

    expect(existsSync(project.counterPath)).toBe(false);
    const payload = JSON.parse(output.at(-1)!) as {
      ok: boolean;
      runtime?: {
        programDigest?: string;
        coordinates?: unknown[];
        findings?: Array<{ code?: string }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.runtime?.programDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.runtime?.coordinates).toEqual([]);
    expect(payload.runtime?.findings).toContainEqual(expect.objectContaining({
      code: "COLLECTION_PROVIDER_DEFERRED",
    }));
  }, 20_000);

  it("inspects a provider collection without executing the provider", async () => {
    const project = await collectionProject("inspect");
    process.chdir(project.root);
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("cards", { at: "0", summary: true });

    expect(existsSync(project.counterPath)).toBe(false);
    const report = JSON.parse(output.at(-1)!) as {
      runtime?: {
        kind?: string;
        programDigest?: string;
        coordinates?: unknown[];
        findings?: Array<{ code?: string }>;
      };
    };
    expect(report.runtime).toMatchObject({
      kind: "collection",
      coordinates: [],
    });
    expect(report.runtime?.programDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(report.runtime?.findings).toContainEqual(expect.objectContaining({
      code: "COLLECTION_PROVIDER_DEFERRED",
    }));
  }, 20_000);
});

async function collectionProject(label: string): Promise<{
  root: string;
  counterPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), `superimg-cli-${label}-`));
  roots.push(root);
  const counterPath = join(root, "provider-count.txt");
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(
    join(root, "entries.server.ts"),
    [
      'import { appendFileSync } from "node:fs";',
      "export function loadCards() {",
      `  appendFileSync(${JSON.stringify(counterPath)}, "x");`,
      "  return [",
      '    { id: "one", title: "One" },',
      '    { id: "two", title: "Two" },',
      "  ];",
      "}",
    ].join("\n"),
  );
  await writeFile(
    join(root, "cards.media.ts"),
    [
      'import { collection, image, Html } from "@foxworth/superimg";',
      'import { loadCards } from "./entries.server";',
      "export default collection({",
      "  entries: loadCards,",
      "  media: image({",
      "    size: { width: 320, height: 180 },",
      '    render: (ctx) => Html({ width: "fill", height: "fill", html: `<h1>${ctx.data.title}</h1>` }),',
      "  }),",
      "});",
    ].join("\n"),
  );
  return { root, counterPath };
}
