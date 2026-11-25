#!/usr/bin/env npx tsx

/**
 * Catalog-wide, browser-free compatibility gate for shipped examples.
 *
 * Every examples/_templates.json entry must resolve to exactly one canonical
 * <id>.media.ts or <id>.media.js file under its declared category. The gate
 * then exercises the same server bundler, compiler, resolve hook, stdlib
 * capability preparation, and native frame renderer used by SuperImg.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { exampleFrameSamples, type ExampleCompositionSchedule } from "./example-frame-samples.mjs";

type BundlerModule = typeof import("../packages/superimg-core/dist/bundler.js");
type CoreModule = typeof import("../packages/superimg-core/dist/index.js");

let bundleMediaProgram: BundlerModule["bundleMediaProgram"];
let applyTemplateResolve: CoreModule["applyTemplateResolve"];
let compileTemplate: CoreModule["compileTemplate"];
let createPreparedStdlibForTemplate: CoreModule["createPreparedStdlibForTemplate"];
let renderTemplateFrame: CoreModule["renderTemplateFrame"];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_ROOT = path.join(REPO_ROOT, "examples");
const CATALOG_PATH = path.join(EXAMPLES_ROOT, "_templates.json");

// The public playground hosts deterministic definitions in a passive Player.
// This standalone lesson is exercised with InteractivePlayer instead.
const STANDALONE_INTERACTIVE = new Set(["basics/request-journey"]);

const EXAMPLE_CATEGORIES = [
  "basics",
  "marketing",
  "events",
  "social",
  "interfaces",
  "data",
  "vector",
  "developer",
  "composed",
] as const;

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(
    4,
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length,
  ),
);

type ExampleCategory = (typeof EXAMPLE_CATEGORIES)[number];

interface CatalogMetadata {
  title: string;
  category: ExampleCategory;
  directory?: string;
  description?: string;
}

interface CatalogEntry {
  id: string;
  metadata: CatalogMetadata;
}

type FailureStage =
  | "structure"
  | "bundle"
  | "compile"
  | "resolve"
  | "capabilities"
  | `frame:${string}`;

interface Failure {
  stage: FailureStage;
  message: string;
}

interface EntryResult {
  entry: CatalogEntry;
  entrypoint?: string;
  medium?: string;
  elapsedMs: number;
  failures: Failure[];
  attempted: {
    bundle: boolean;
    compile: boolean;
    resolve: boolean;
    capabilities: boolean;
    frames: number;
  };
  succeeded: {
    bundle: boolean;
    compile: boolean;
    resolve: boolean;
    capabilities: boolean;
    frames: number;
  };
}

function parseConcurrency(): number {
  const raw = process.env.SUPERIMG_EXAMPLE_CONCURRENCY;
  if (raw === undefined) return DEFAULT_CONCURRENCY;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 16) {
    throw new Error(
      `SUPERIMG_EXAMPLE_CONCURRENCY must be an integer from 1 to 16; received ${JSON.stringify(raw)}.`,
    );
  }
  return value;
}

async function loadRuntime(): Promise<void> {
  const [bundler, core] = await Promise.all([
    import("../packages/superimg-core/dist/bundler.js"),
    import("../packages/superimg-core/dist/index.js"),
  ]);
  bundleMediaProgram = bundler.bundleMediaProgram;
  applyTemplateResolve = core.applyTemplateResolve;
  compileTemplate = core.compileTemplate;
  createPreparedStdlibForTemplate = core.createPreparedStdlibForTemplate;
  renderTemplateFrame = core.renderTemplateFrame;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function relative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${relative(CATALOG_PATH)}: ${errorDetail(error)}`);
  }

  if (!isRecord(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${relative(CATALOG_PATH)} must be a non-empty object.`);
  }

  const entries: CatalogEntry[] = [];
  const catalogFailures: string[] = [];

  for (const [id, rawMetadata] of Object.entries(parsed)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      catalogFailures.push(`${JSON.stringify(id)} must be a lowercase example id`);
      continue;
    }
    if (!isRecord(rawMetadata)) {
      catalogFailures.push(`${JSON.stringify(id)} metadata must be an object`);
      continue;
    }

    const { title, category, description, directory } = rawMetadata;
    if (typeof title !== "string" || !title.trim()) {
      catalogFailures.push(`${JSON.stringify(id)}.title must be a non-empty string`);
      continue;
    }
    if (
      typeof category !== "string" ||
      !(EXAMPLE_CATEGORIES as readonly string[]).includes(category)
    ) {
      catalogFailures.push(
        `${JSON.stringify(id)}.category must be one of: ${EXAMPLE_CATEGORIES.join(", ")}; ` +
          `received ${JSON.stringify(category)}`,
      );
      continue;
    }
    if (description !== undefined && typeof description !== "string") {
      catalogFailures.push(`${JSON.stringify(id)}.description must be a string when provided`);
      continue;
    }
    if (directory !== undefined && (typeof directory !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory))) {
      catalogFailures.push(`${JSON.stringify(id)}.directory must be a folder name within the category`);
      continue;
    }

    entries.push({
      id,
      metadata: {
        title,
        category: category as ExampleCategory,
        ...(directory !== undefined ? { directory } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });
  }

  if (catalogFailures.length > 0) {
    throw new Error(
      `${relative(CATALOG_PATH)} has ${catalogFailures.length} invalid entr${
        catalogFailures.length === 1 ? "y" : "ies"
      }:\n${catalogFailures.map((failure) => `  - ${failure}`).join("\n")}`,
    );
  }

  // A new canonical program in a public category must not silently miss the
  // catalog gate. Helpers, composition chapters, apps, and local showcases are
  // separate from these canonical <directory>/<directory>.media entries.
  for (const category of EXAMPLE_CATEGORIES) {
    const folders = await fs.readdir(path.join(EXAMPLES_ROOT, category), { withFileTypes: true });
    for (const folder of folders.filter(folder => folder.isDirectory() && !folder.name.startsWith("_"))) {
      if (STANDALONE_INTERACTIVE.has(`${category}/${folder.name}`)) continue;
      for (const extension of ["ts", "js"]) {
        const canonical = path.join(EXAMPLES_ROOT, category, folder.name, `${folder.name}.media.${extension}`);
        if (await fs.stat(canonical).then(stat => stat.isFile(), () => false)) {
          if (!entries.some(entry => entry.id === folder.name && entry.metadata.category === category)) {
            throw new Error(`${relative(canonical)} is missing from ${relative(CATALOG_PATH)}`);
          }
        }
      }
    }
  }

  return entries;
}

async function resolveEntrypoint(entry: CatalogEntry): Promise<string> {
  const directory = path.join(EXAMPLES_ROOT, entry.metadata.category, entry.metadata.directory ?? entry.id);
  const candidates = [
    path.join(directory, `${entry.id}.media.ts`),
    path.join(directory, `${entry.id}.media.js`),
  ];
  const existing: string[] = [];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) existing.push(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  if (existing.length !== 1) {
    let directoryFiles: string[] = [];
    try {
      directoryFiles = (await fs.readdir(directory))
        .filter((file) => file.endsWith(".media.ts") || file.endsWith(".media.js"))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    throw new Error(
      `Expected exactly one canonical entry file at ` +
        `${relative(candidates[0]!)} or ${relative(candidates[1]!)}, found ${existing.length}. ` +
        `Media files in the declared directory: ${
          directoryFiles.length > 0 ? directoryFiles.join(", ") : "(none)"
        }.`,
    );
  }

  return existing[0]!;
}

function assertMarkup(
  markup: unknown,
  entry: CatalogEntry,
  sample: string,
  isSvg: boolean,
): void {
  if (typeof markup !== "string" || markup.trim().length === 0) {
    throw new Error(
      `${entry.id} returned ${typeof markup === "string" ? "empty markup" : typeof markup} at ${sample}.`,
    );
  }

  if (/(?:style|d|points|transform|width|height|cx|cy|x|y|r)="[^"\n]*\b(?:NaN|Infinity)\b/i.test(markup)) {
    throw new Error(`${entry.id} returned non-finite output at ${sample}.`);
  }

  if (!isSvg) return;

  const trimmed = markup.trim().replace(/^<\?xml[^>]*>\s*/i, "");
  if (!/^<svg(?:\s|>)/i.test(trimmed)) {
    throw new Error(
      `${entry.id} has medium \"svg\" but ${sample} does not start with an <svg> root.`,
    );
  }
  if (!/<\/svg>\s*$/i.test(trimmed) && !/<svg\b[^>]*\/\s*>\s*$/i.test(trimmed)) {
    throw new Error(`${entry.id} has medium \"svg\" but ${sample} has no closing SVG root.`);
  }
}

async function verifyEntry(entry: CatalogEntry): Promise<EntryResult> {
  const startedAt = performance.now();
  const result: EntryResult = {
    entry,
    elapsedMs: 0,
    failures: [],
    attempted: {
      bundle: false,
      compile: false,
      resolve: false,
      capabilities: false,
      frames: 0,
    },
    succeeded: {
      bundle: false,
      compile: false,
      resolve: false,
      capabilities: false,
      frames: 0,
    },
  };

  let entrypoint: string;
  try {
    entrypoint = await resolveEntrypoint(entry);
    result.entrypoint = entrypoint;
  } catch (error) {
    result.failures.push({ stage: "structure", message: errorDetail(error) });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }

  let bundle: Awaited<ReturnType<typeof bundleMediaProgram>>;
  result.attempted.bundle = true;
  try {
    bundle = await bundleMediaProgram(entrypoint);
    result.succeeded.bundle = true;
  } catch (error) {
    result.failures.push({ stage: "bundle", message: errorDetail(error) });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }

  result.attempted.compile = true;
  let compiled: ReturnType<typeof compileTemplate>;
  try {
    compiled = compileTemplate(bundle);
  } catch (error) {
    result.failures.push({ stage: "compile", message: errorDetail(error) });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }
  if (compiled.error || !compiled.media) {
    result.failures.push({
      stage: "compile",
      message: errorDetail(compiled.error ?? new Error("Compiler returned no media.")),
    });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }
  result.succeeded.compile = true;

  const composition = (compiled.media as typeof compiled.media & {
    composition?: { schedule?: ExampleCompositionSchedule };
  }).composition;
  const frameSamples = exampleFrameSamples(composition?.schedule);

  result.attempted.resolve = true;
  let applied: Awaited<ReturnType<typeof applyTemplateResolve>>;
  try {
    applied = await applyTemplateResolve(compiled.media, {
      assetResolver: (filename) => filename,
    });
    result.succeeded.resolve = true;
  } catch (error) {
    result.failures.push({ stage: "resolve", message: errorDetail(error) });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }

  result.medium = applied.template.medium;

  result.attempted.capabilities = true;
  let preparedStdlib: Awaited<ReturnType<typeof createPreparedStdlibForTemplate>>;
  try {
    preparedStdlib = await createPreparedStdlibForTemplate(applied.template);
    result.succeeded.capabilities = true;
  } catch (error) {
    result.failures.push({ stage: "capabilities", message: errorDetail(error) });
    result.elapsedMs = performance.now() - startedAt;
    return result;
  }

  for (const sample of frameSamples) {
    result.attempted.frames += 1;
    try {
      const { html: markup } = renderTemplateFrame({
        template: applied.template,
        data: applied.data,
        ...(sample.frame !== undefined ? { frame: sample.frame } : { progress: sample.progress ?? 0 }),
        composite: false,
        preparedStdlib,
        assetResolver: (filename) => filename,
      });
      assertMarkup(markup, entry, sample.name, applied.template.medium === "svg");
      result.succeeded.frames += 1;
    } catch (error) {
      result.failures.push({
        stage: `frame:${sample.name}`,
        message: errorDetail(error),
      });
    }
  }

  result.elapsedMs = performance.now() - startedAt;
  return result;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
  onResult?: (result: R, completed: number) => void,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      const result = await task(values[index]!);
      results[index] = result;
      completed += 1;
      onResult?.(result, completed);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

function stageSummary(results: readonly EntryResult[]): string[] {
  const count = (
    key: keyof EntryResult["attempted"],
    source: "attempted" | "succeeded",
  ) =>
    results.reduce((total, result) => {
      const value = result[source][key];
      return total + (typeof value === "boolean" ? Number(value) : value);
    }, 0);

  return [
    `bundle ${count("bundle", "succeeded")}/${count("bundle", "attempted")}`,
    `compile ${count("compile", "succeeded")}/${count("compile", "attempted")}`,
    `resolve ${count("resolve", "succeeded")}/${count("resolve", "attempted")}`,
    `capabilities ${count("capabilities", "succeeded")}/${count("capabilities", "attempted")}`,
    `frames ${count("frames", "succeeded")}/${count("frames", "attempted")}`,
  ];
}

async function main(): Promise<void> {
  const startedAt = performance.now();
  const concurrency = parseConcurrency();
  await loadRuntime();
  const entries = await loadCatalog();

  process.stdout.write(
    `Verifying ${entries.length} catalog examples with concurrency ${concurrency}...\n`,
  );

  const results = await mapWithConcurrency(
    entries,
    concurrency,
    verifyEntry,
    (result, completed) => {
      const status = result.failures.length === 0 ? "pass" : "FAIL";
      const kind = result.medium ?? "unresolved";
      process.stdout.write(
        `[${status} ${String(completed).padStart(String(entries.length).length, " ")}/${entries.length}] ` +
          `${result.entry.id} (${result.entry.metadata.category}, ${kind}, ${Math.round(result.elapsedMs)}ms)\n`,
      );
    },
  );

  const failed = results.filter((result) => result.failures.length > 0);
  const passed = results.length - failed.length;
  const elapsedMs = performance.now() - startedAt;

  const summary =
    `Example catalog: ${passed} passed, ${failed.length} failed, ${entries.length} total ` +
    `in ${(elapsedMs / 1000).toFixed(2)}s.\n` +
    `Stages: ${stageSummary(results).join(", ")}.\n`;

  if (failed.length > 0) {
    let report = `\n${failed.length} catalog example(s) failed:\n`;
    for (const result of failed.sort((a, b) => a.entry.id.localeCompare(b.entry.id))) {
      report +=
        `\n${result.entry.id} (${result.entry.metadata.category})` +
        `${result.entrypoint ? ` — ${relative(result.entrypoint)}` : ""}\n`;
      for (const failure of result.failures) {
        const indented = failure.message.replace(/\n/g, "\n      ");
        report += `  [${failure.stage}] ${indented}\n`;
      }
    }
    process.stderr.write(`${report}\n${summary}`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`\n${summary}`);
}

main().catch((error) => {
  process.stderr.write(`Example catalog verification could not start:\n${errorDetail(error)}\n`);
  process.exitCode = 1;
});
