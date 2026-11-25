//! Manual, host-driven projection of a retained sequence into one Player (private implementation).

import type { CanvasSize, CompositionContent, InteractiveCompositionRuntime, Program, SequenceProgram, Use } from "@superimg/types";
import { time } from "@superimg/core/composition";
import type { DomPlayer } from "./dom-player.js";
import type { LoadOptions, LoadResult, PlayerInput } from "./player-types.js";
import { loadErrorResult, supersededLoadResult } from "./player-load.js";

export interface ProgramPart {
  readonly id: string;
  readonly label?: string;
  readonly media: PlayerInput;
  readonly loadOptions?: LoadOptions;
  /** Runtime host bridge for a direct interactive child. */
  readonly interactiveRuntime?: InteractiveCompositionRuntime;
}

export interface PartProjection {
  readonly media: PlayerInput;
  readonly loadOptions?: LoadOptions;
}

export interface PartProjectorOptions {
  readonly initialId?: string;
  /** Required only when projecting nested programs into timed pages. */
  readonly size?: CanvasSize;
  /** Required only when projecting nested programs into timed pages. */
  readonly fps?: number;
  /** Selections keyed by qualified choice paths in the source sequence. */
  readonly routes?: Readonly<Record<string, string>>;
  readonly inspection?: boolean;
  /** Host-owned source preparation performed each time a selected page loads. */
  readonly prepare?: (part: ProgramPart) => PartProjection | Promise<PartProjection>;
}

export interface PartProjector {
  /** Top-level named occurrences in authored order. */
  readonly parts: readonly ProgramPart[];
  readonly currentId: string | null;
  readonly currentIndex: number;
  readonly ready: Promise<LoadResult>;
  go(id: string): Promise<LoadResult>;
  next(): Promise<LoadResult>;
  previous(): Promise<LoadResult>;
  /** Remove listeners and stop controller updates; the shared Player stays alive. */
  dispose(): void;
}

export function createPartProjector(
  player: Pick<DomPlayer, "load"> & Partial<Pick<DomPlayer, "cancelPendingLoad">>,
  source: SequenceProgram | readonly ProgramPart[],
  options: PartProjectorOptions = {},
): PartProjector {
  const parts: readonly ProgramPart[] = Array.isArray(source)
    ? validateParts(source, options)
    : sequenceParts(source as SequenceProgram, options);
  if (parts.length === 0) throw new Error("A Program projection requires at least one named part.");

  let committedId: string | null = null;
  let requestedIndex = parts.findIndex((part) => part.id === options.initialId);
  if (options.initialId !== undefined && requestedIndex < 0) {
    throw new Error(`Unknown initial Program part: ${options.initialId}`);
  }
  if (requestedIndex < 0) requestedIndex = 0;
  let request = 0;
  let disposed = false;

  const goIndex = async (index: number): Promise<LoadResult> => {
    if (disposed) throw new Error("PartProjector is disposed");
    const normalized = Math.max(0, Math.min(parts.length - 1, index));
    requestedIndex = normalized;
    const token = ++request;
    const part = parts[normalized]!;
    player.cancelPendingLoad?.();
    let result: LoadResult;
    try {
      const projection = options.prepare ? await options.prepare(part) : part;
      if (disposed || token !== request) return supersededLoadResult();
      const loadOptions = { ...part.loadOptions, ...projection.loadOptions,
        ...(part.loadOptions?.data || projection.loadOptions?.data
          ? { data: { ...part.loadOptions?.data, ...projection.loadOptions?.data } } : {}),
      };
      result = await player.load(projection.media, Object.keys(loadOptions).length ? loadOptions : undefined);
    } catch (error) {
      result = loadErrorResult(error);
    }
    if (disposed || token !== request) return supersededLoadResult();
    if (!disposed && token === request && result.status === "success") {
      committedId = part.id;
    } else if (token === request && result.status === "error") {
      requestedIndex = committedId === null
        ? normalized
        : parts.findIndex((candidate) => candidate.id === committedId);
    }
    return result;
  };

  const initial = goIndex(requestedIndex);
  void initial.catch(() => undefined);

  return {
    parts,
    ready: initial,
    get currentId() { return committedId; },
    get currentIndex() { return committedId === null ? requestedIndex : parts.findIndex((p) => p.id === committedId); },
    go(id) {
      const index = parts.findIndex((part) => part.id === id);
      if (index < 0) throw new Error(`Unknown Program part: ${id}`);
      return goIndex(index);
    },
    next: () => goIndex(requestedIndex + 1),
    previous: () => goIndex(requestedIndex - 1),
    dispose() {
      disposed = true;
      request++;
    },
  };
}

function sequenceParts(program: SequenceProgram, options: PartProjectorOptions): readonly ProgramPart[] {
  if (program.op !== "sequence") throw new Error("createPartProjector() requires a sequence program.");
  validateRoutes(program, options.routes);
  const ids = new Set<string>();
  return program.parts.map((use) => {
    if (!use.id || ids.has(use.id)) throw new Error(`Sequence part IDs must be unique and non-empty: ${use.id}`);
    ids.add(use.id);
    const content = use.content as CompositionContent;
    const leaf = content && typeof content === "object" && "op" in content
      ? undefined
      : content as PlayerInput;
    let projection: PartProjection;
    if (content && typeof content === "object" && "kind" in content && content.kind === "interactive" &&
        "createCompositionRuntime" in content && typeof content.createCompositionRuntime === "function") {
      const interactiveRuntime = content.createCompositionRuntime();
      // CompositionMedia erases each child's resolve data parameter to never;
      // its runtime media still implements the PlayerInput shape.
      projection = { media: interactiveRuntime.media as PlayerInput, ...(use.data === undefined ? {} : { loadOptions: { data: use.data } }) };
      return { id: use.id, media: projection.media, interactiveRuntime, ...(projection.loadOptions ? { loadOptions: projection.loadOptions } : {}) };
    } else if (leaf) {
      projection = { media: leaf, ...(use.data === undefined ? {} : { loadOptions: { data: use.data } }) };
    } else {
      if (!options.size || options.fps === undefined) {
        throw new Error(`Sequence part "${use.id}" is nested; createPartProjector() needs size and fps to time it as a part.`);
      }
      const routes = partRoutes(options.routes, use.id);
      projection = {
        media: time(content as Program, {
          size: options.size,
          fps: options.fps,
          ...(routes === undefined ? {} : { routes }),
          ...(options.inspection ? { inspection: true } : {}),
        }),
      };
    }
    return { id: use.id, media: projection.media, ...(projection.loadOptions ? { loadOptions: projection.loadOptions } : {}) };
  });
}

function validateParts(input: readonly ProgramPart[], options: PartProjectorOptions): readonly ProgramPart[] {
  if (options.routes && Object.keys(options.routes).length > 0) {
    throw new Error("Program routes require a retained sequence program.");
  }
  const ids = new Set<string>();
  for (const part of input) {
    if (!part.id || ids.has(part.id)) throw new Error(`Program part IDs must be unique and non-empty: ${part.id}`);
    ids.add(part.id);
  }
  return [...input];
}

function isProgram(content: CompositionContent): content is Program {
  return typeof content === "object" && content !== null && "op" in content;
}

function choicePaths(content: CompositionContent, path: string, out: Set<string>, stack = new Set<object>()): void {
  if (!isProgram(content)) return;
  if (stack.has(content)) return;
  stack.add(content);
  try {
    if (content.op === "choose") {
      out.add(path || "root");
      for (const [id, child] of Object.entries(content.paths)) {
        choicePaths(child, path ? `${path}/${id}` : id, out, stack);
      }
      return;
    }
    for (const use of content.parts) {
      choicePaths(use.content, path ? `${path}/${use.id}` : use.id, out, stack);
    }
  } finally {
    stack.delete(content);
  }
}

function validateRoutes(program: SequenceProgram, routes: PartProjectorOptions["routes"]): void {
  if (routes === undefined) return;
  const known = new Set<string>();
  choicePaths(program, "", known);
  for (const path of Object.keys(routes)) {
    if (!known.has(path)) throw new Error(`Unknown Program route "${path}".`);
  }
}

/** Convert whole-story route paths into the path space of one timed Program part. */
function partRoutes(routes: PartProjectorOptions["routes"], partId: string): Readonly<Record<string, string>> | undefined {
  if (routes === undefined) return undefined;
  const page = Object.entries(routes).flatMap(([path, selection]) => {
    if (path === partId) return [["root", selection] as const];
    const prefix = `${partId}/`;
    return path.startsWith(prefix) ? [[path.slice(prefix.length), selection] as const] : [];
  });
  return page.length === 0 ? undefined : Object.freeze(Object.fromEntries(page));
}
