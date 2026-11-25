//! script — which films read a `*.script.md`, where each block sits on a
//! film's clock, and a still for each block. Built for editors: JSON on stdout,
//! one process per question, and one browser session for a batch of stills.

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Command } from "commander";
import { render as runtimeRender } from "@foxworth/superimg/internal/runtime-kernel";
import {
  createNodeScriptInteractionMount,
  SCRIPT_INTERACTION_IDS,
} from "@foxworth/superimg-interactions";
import {
  compileNodeMediaSource,
  fitPngWidth,
  MediaScriptError,
  pngSize,
  readScriptCues,
  type MediaScriptCue,
} from "@foxworth/superimg-node/source";
import { parseScript, scriptBlocks, scriptHash, type ScriptBlock } from "@foxworth/superimg-script";
import type { ExportableMedia } from "@superimg/types";
import { commandResult } from "../utils/command-result.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createCliValueRuntime } from "../utils/media-interactions.js";
import { loadCliMediaValue } from "../utils/runtime-source.js";

interface JsonOptions {
  json?: boolean;
  pretty?: boolean;
}

function print(value: object, options: JsonOptions): void {
  console.log(JSON.stringify(commandResult(value), null, options.pretty ? 2 : undefined));
}

/** A media path is resolved against the working directory; its project owns the ids. */
function mediaFile(source: string): { file: string; projectRoot: string } {
  const file = resolve(source);
  if (!existsSync(file)) throw new MediaScriptError("SOURCE_NOT_FOUND", `Media source does not exist: ${source}`);
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot(dirname(file));
  } catch {
    projectRoot = dirname(file);
  }
  return { file, projectRoot };
}

export async function scriptSourcesCommand(script: string, options: JsonOptions & { root?: string }): Promise<void> {
  // Compare real paths, so a root reached through a symlink still contains its script.
  const real = (path: string) => (existsSync(path) ? realpathSync(path) : path);
  const root = real(resolve(options.root ?? process.cwd()));
  const result = await createNodeScriptInteractionMount<object>({ projectRoot: root }).dispatch({
    interactionId: SCRIPT_INTERACTION_IDS.sources,
    input: { script: relative(root, real(resolve(script))) || script },
  }, {});
  if (options.json) return print(result, options);
  if (result.sources.length === 0) {
    console.log(`No media source under ${root} imports ${result.scriptPath}.`);
    return;
  }
  for (const source of result.sources) console.log(source.relativePath);
}

/** The Markdown audiovisual table: one row per cue with its picture and the words read. */
export function cueTable(
  cues: readonly Pick<MediaScriptCue, "blockId" | "startSeconds" | "endSeconds">[],
  scriptBlocksList: readonly ScriptBlock[],
): string[] {
  const blocks = new Map(scriptBlocksList.map(block => [block.id, block]));
  const cell = (text: string) => text.replaceAll("|", "&#124;").replace(/\r?\n/g, "<br>");
  const rows = ["| Cue | Start | End | Picture | Speech or card |", "| --- | ---: | ---: | --- | --- |"];
  for (const cue of cues) {
    const block = blocks.get(cue.blockId);
    const picture = block && "text" in block ? block.text : "";
    const line = block && "lines" in block ? block.lines.join("\n") : "";
    // A card's attribution, sign and source are part of what the audience reads.
    const credits = block?.kind === "card"
      ? [["Attribution", block.attribution], ["Sign", block.sign], ["Source", block.source]]
        .flatMap(([label, value]) => (value ? [`${label}: ${value}`] : []))
      : [];
    const words = block && "who" in block ? `${block.who}: ${line}` : [line, ...credits].filter(Boolean).join("\n");
    rows.push(`| ${cue.blockId} | ${cue.startSeconds.toFixed(2)}s | ${cue.endSeconds.toFixed(2)}s | ${cell(picture)} | ${cell(words)} |`);
  }
  return rows;
}

export async function scriptCuesCommand(
  source: string,
  options: JsonOptions & { md?: boolean; entry?: string },
): Promise<void> {
  const { file, projectRoot } = mediaFile(source);
  const result = await createNodeScriptInteractionMount<object>({ projectRoot }).dispatch({
    interactionId: SCRIPT_INTERACTION_IDS.cues,
    input: {
      source: file,
      ...(options.entry === undefined ? {} : { entryId: options.entry }),
    },
  }, {});
  if (options.json) return print(result, options);
  if (options.md) {
    const doc = parseScript(readFileSync(resolve(projectRoot, result.scriptPath), "utf8"));
    if (!doc || scriptHash(doc) !== result.scriptHash) {
      throw new MediaScriptError("SCRIPT_CHANGED", "The script changed while reading its cues. Run the command again.");
    }
    for (const row of cueTable(result.cues, scriptBlocks(doc))) console.log(row);
    return;
  }
  console.log(`${result.relativePath} reads ${result.scriptPath} (${result.durationSeconds}s at ${result.fps} fps)`);
  for (const cue of result.cues) {
    console.log(`  ${cue.blockId.padEnd(24)} ${cue.startSeconds.toFixed(2)}s  costs ${cue.costSeconds.toFixed(2)}s`);
  }
  if (result.unplaced.length) console.log(`  not placed: ${result.unplaced.join(", ")}`);
  if (result.unknownCues.length) console.log(`  cues with no block: ${result.unknownCues.join(", ")}`);
  for (const finding of result.findings) console.log(`  ${finding.blockId}: ${finding.message}`);
}

export async function scriptStillsCommand(
  source: string,
  options: JsonOptions & { out: string; maxWidth?: string; block?: string[]; entry?: string },
): Promise<void> {
  const maxWidth = options.maxWidth === undefined ? undefined : Number(options.maxWidth);
  if (maxWidth !== undefined && (!Number.isInteger(maxWidth) || maxWidth < 16)) {
    throw new MediaScriptError("INVALID_INPUT", "--max-width must be a whole number of pixels, 16 or more.");
  }
  const { file, projectRoot } = mediaFile(source);
  // Stills stay a direct command: they apply the project's cascading config, as export does,
  // and write files. `media.script.still` is the one-frame, in-memory form of the same read.
  // One compilation serves the cues and every frame, so the hashes describe the stills.
  const preparedSource = await compileNodeMediaSource(projectRoot, file);
  const cues = await readScriptCues(projectRoot, file, {
    preparedSource,
    ...(options.entry === undefined ? {} : { entryId: options.entry }),
  });
  const byId = new Map(cues.cues.map((cue) => [cue.blockId, cue]));
  const requested = options.block?.length ? [...new Set(options.block)] : cues.cues.map((cue) => cue.blockId);
  const wanted = requested.flatMap((id) => (byId.has(id) ? [byId.get(id) as MediaScriptCue] : []));
  const missing = requested.filter((id) => !byId.has(id));

  const out = resolve(options.out);
  mkdirSync(out, { recursive: true });
  const totalFrames = Math.max(1, Math.round(cues.durationSeconds * cues.fps));
  const stills: object[] = [];
  if (wanted.length > 0) {
    const runtime = createCliValueRuntime();
    try {
      const loaded = await loadCliMediaValue(file, { preparedSource });
      for (const cue of wanted) {
        const frame = Math.min(totalFrames - 1, Math.max(0, Math.round(cue.stillSeconds * cues.fps)));
        const rendered = await runtimeRender(runtime, loaded.value as ExportableMedia, {
          as: "png",
          at: `${frame}f`,
          providers: "skip",
          ...(cues.entryId === undefined ? {} : { entryId: cues.entryId }),
        });
        const bytes = await fitPngWidth(await rendered.bytes(), maxWidth);
        const path = join(out, `${cue.blockId}.png`);
        // Write beside the target, then rename, so a reader never sees half a file
        // and an interrupted batch never leaves one that looks complete.
        const partial = join(out, `.${cue.blockId}.${process.pid}.partial`);
        writeFileSync(partial, bytes);
        renameSync(partial, path);
        stills.push({
          blockId: cue.blockId,
          atSeconds: Math.round((frame / cues.fps) * 1e6) / 1e6,
          frame,
          path,
          ...pngSize(bytes),
          bytes: bytes.byteLength,
        });
      }
    } finally {
      await runtime.dispose();
    }
  }
  const result = {
    schemaVersion: 0,
    kind: "media-script-stills",
    sourceId: cues.sourceId,
    relativePath: cues.relativePath,
    programHash: cues.programHash,
    scriptPath: cues.scriptPath,
    scriptHash: cues.scriptHash,
    stills,
    /** Requested block ids the film publishes no cue for. */
    missing,
  };
  if (options.json) return print(result, options);
  for (const still of stills as { blockId: string; path: string }[]) console.log(`${still.blockId}  ${still.path}`);
  if (missing.length) console.log(`no cue: ${missing.join(", ")}`);
}

const collect = (value: string, previous: string[] = []) => [...previous, value];

export function registerScriptCommands(program: Command): void {
  const script = program
    .command("script")
    .description("Connect a *.script.md file to the films that read it");

  script
    .command("sources")
    .description("List the media sources that import a script. Runs no film code.")
    .argument("<script>", "Path to a *.script.md file")
    .option("--root <dir>", "Directory to search. Nothing outside it is read. Defaults to the working directory.")
    .option("--json", "Machine-readable JSON on stdout")
    .option("--pretty", "Pretty-print JSON")
    .action(async (file: string, options) => scriptSourcesCommand(file, options));

  script
    .command("cues")
    .description("Report where each script block sits on a film's clock")
    .argument("<source>", "Path to a *.media.ts file")
    .option("--entry <id>", "Entry id when <source> exports a static collection()")
    .option("--json", "Machine-readable JSON on stdout")
    .option("--pretty", "Pretty-print JSON")
    .option("--md", "Print a Markdown audiovisual cue table")
    .action(async (source: string, options) => scriptCuesCommand(source, options));

  script
    .command("stills")
    .description("Render one PNG per script block, in one browser session")
    .argument("<source>", "Path to a *.media.ts file")
    .requiredOption("--out <dir>", "Directory to write <blockId>.png files into")
    .option("--entry <id>", "Entry id when <source> exports a static collection()")
    .option("--max-width <pixels>", "Scale wider frames down to this width")
    .option("--block <id>", "Render only this block. Repeat for several. Default: every cue.", collect)
    .option("--json", "Machine-readable JSON on stdout")
    .option("--pretty", "Pretty-print JSON")
    .action(async (source: string, options) => scriptStillsCommand(source, options));
}
