//! film — inspect films built with `film()`: per-shot cast & prop breakdowns.

import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { Command } from "commander";
import { MediaScriptError } from "@foxworth/superimg-node/source";
import type { ResolveBreakdown, ResolveFn, ResolveShotBreakdown } from "@superimg/types";
import { commandResult } from "../utils/command-result.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCliMediaValue } from "../utils/runtime-source.js";

const FILM_BREAKDOWN_SYMBOL = Symbol.for("superimg.film.breakdown");

interface JsonOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface FilmBreakdownOptions extends JsonOptions {
  with?: string[];
}

type ResolvableMedia = {
  sample?: unknown;
  config?: Record<string, unknown>;
  resolve?: ResolveFn<unknown>;
  [FILM_BREAKDOWN_SYMBOL]?: (data?: unknown) => ResolveBreakdown;
};

function print(value: object, options: JsonOptions): void {
  console.log(JSON.stringify(commandResult(value), null, options.pretty ? 2 : undefined));
}

function mediaFile(source: string): { file: string; projectRoot: string } {
  const file = resolve(source);
  if (!existsSync(file)) {
    throw new MediaScriptError("SOURCE_NOT_FOUND", `Media source does not exist: ${source}`);
  }
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot(dirname(file));
  } catch {
    projectRoot = dirname(file);
  }
  return { file, projectRoot };
}

/** Normalize a subject name for matching (`"Cinnamon Jar"` ↔ `"cinnamon-jar"`). */
export function normalizeSubject(name: string): string {
  return name.trim().toLowerCase().replace(/[-\s]+/g, "-");
}

/** Keep only shots where every requested subject appears in either `cast` or `props`. */
export function filterBreakdown(
  breakdown: ResolveBreakdown,
  withSubjects: readonly string[],
): ResolveBreakdown {
  const required = withSubjects.map(normalizeSubject).filter(Boolean);
  if (required.length === 0) return breakdown;
  const filtered: ResolveBreakdown = {};
  for (const [shotId, entry] of Object.entries(breakdown)) {
    const present = new Set([
      ...entry.cast.map(normalizeSubject),
      ...entry.props.map(normalizeSubject),
    ]);
    if (required.every((subject) => present.has(subject))) {
      filtered[shotId] = entry;
    }
  }
  return filtered;
}

/** Render a shots × subjects table for terminal output. */
export function breakdownTable(breakdown: ResolveBreakdown): string[] {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return [];

  const rows = entries.map(([shotId, entry]) => ({
    shot: shotId,
    cast: entry.cast.length > 0 ? entry.cast.join(", ") : "-",
    props: entry.props.length > 0 ? entry.props.join(", ") : "-",
  }));

  const shotWidth = Math.max("Shot".length, ...rows.map((r) => r.shot.length));
  const castWidth = Math.max("Cast".length, ...rows.map((r) => r.cast.length));
  const propsWidth = Math.max("Props".length, ...rows.map((r) => r.props.length));

  const pad = (shot: string, cast: string, props: string) =>
    `${shot.padEnd(shotWidth)}  ${cast.padEnd(castWidth)}  ${props}`;

  return [
    pad("Shot", "Cast", "Props"),
    pad("-".repeat(shotWidth), "-".repeat(castWidth), "-".repeat(propsWidth)),
    ...rows.map((r) => pad(r.shot, r.cast, r.props)),
  ];
}

export async function readFilmBreakdown(source: string): Promise<{
  file: string;
  relativePath: string;
  breakdown: ResolveBreakdown;
}> {
  const { file, projectRoot } = mediaFile(source);
  const loaded = await loadCliMediaValue(file);
  const media = loaded.value as ResolvableMedia | undefined;

  let breakdown: ResolveBreakdown = {};
  if (media && typeof media === "object") {
    const direct = media[FILM_BREAKDOWN_SYMBOL];
    if (typeof direct === "function") {
      breakdown = direct(media.sample);
    } else if (typeof media.resolve === "function") {
      const resolved = await media.resolve({
        data: media.sample ?? {},
        config: (media.config ?? {}) as never,
        asset: (assetPath) => assetPath,
        assets: {},
      });
      if (resolved?.breakdown) {
        breakdown = resolved.breakdown;
      }
    }
  }

  return {
    file,
    relativePath: relative(projectRoot, file) || source,
    breakdown,
  };
}

export async function filmBreakdownCommand(
  media: string,
  options: FilmBreakdownOptions = {},
): Promise<void> {
  const { relativePath, breakdown } = await readFilmBreakdown(media);
  const withFilter = (options.with ?? []).map((s) => s.trim()).filter(Boolean);
  const filtered = filterBreakdown(breakdown, withFilter);

  if (options.json) {
    const shots: ({ id: string } & ResolveShotBreakdown)[] = Object.entries(filtered).map(
      ([id, entry]) => ({ id, cast: entry.cast, props: entry.props }),
    );
    print(
      {
        source: relativePath,
        ...(withFilter.length > 0 ? { with: withFilter } : {}),
        shots,
        breakdown: filtered,
      },
      options,
    );
    return;
  }

  const lines = breakdownTable(filtered);
  if (lines.length === 0) {
    if (withFilter.length > 0) {
      console.log(`No shots in ${relativePath} include ${withFilter.join(" and ")}.`);
    } else {
      console.log(`No shots in ${relativePath}.`);
    }
    return;
  }
  for (const line of lines) console.log(line);
}

const collect = (value: string, previous: string[] = []) => [...previous, value];

export function registerFilmCommands(program: Command): void {
  const filmCmd = program
    .command("film")
    .description("Inspect films built with film()");

  filmCmd
    .command("breakdown")
    .description("Show which cast members and props appear in each shot")
    .argument("<media>", "Path to a *.media.ts file")
    .option(
      "--with <subject>",
      "Only show shots containing this cast member or prop. Repeat to require multiple.",
      collect,
    )
    .option("--json", "Machine-readable JSON on stdout")
    .option("--pretty", "Pretty-print JSON")
    .action(async (media: string, options: FilmBreakdownOptions) => filmBreakdownCommand(media, options));
}
