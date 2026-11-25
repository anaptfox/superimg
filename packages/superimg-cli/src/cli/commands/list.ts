//! List command — CLI projections of discovery and source-description receipts.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatError } from "@superimg/core/errors";
import {
  MEDIA_INTERACTION_IDS,
  type MediaSourceDescription,
} from "@foxworth/superimg-interactions";
import { findProjectRoot } from "../utils/find-project-root.js";
import { extractShortName } from "../utils/discover-videos.js";
import {
  createCliMediaInteractionSession,
  type CliMediaInteractionSession,
} from "../utils/media-interactions.js";

interface ListedMedia {
  readonly name: string;
  readonly shortName: string;
  readonly relativePath: string;
  readonly entrypoint: string;
  readonly hasLocalConfig: boolean;
  readonly medium: "html" | "svg";
  readonly animated: boolean;
  readonly kind: "video" | "loop" | "image" | "svg" | "interactive";
  readonly temporal?: "once" | "loop";
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly duration: number;
  readonly config: string;
  readonly collection?: { readonly entries: "static" | "provider" };
  readonly variants?: readonly { readonly id: string }[];
  readonly editions?: readonly {
    readonly id: string;
    readonly width: number;
    readonly height: number;
  }[];
  readonly fonts?: readonly string[];
}

export async function listCommand(
  options: { json?: boolean; shallow?: boolean } = {},
): Promise<void> {
  let projectRoot: string;
  let videos: Awaited<ReturnType<typeof describeProjectMedia>>;
  try {
    projectRoot = findProjectRoot();
    const session = createCliMediaInteractionSession(projectRoot);
    try {
      const discovery = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.discover,
        input: {},
      }, {});
      if (options.shallow) {
        const paths = discovery.sources.map((source) => source.relativePath);
        console.log(options.json ? JSON.stringify(paths, null, 2) : paths.join("\n"));
        return;
      }
      videos = await describeProjectMedia(
        projectRoot,
        session.mount,
        discovery.sources,
      );
    } finally {
      await session.dispose();
    }
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`\n  Error: ${formatted.plain}\n`);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify({ schemaVersion: 0, media: videos }, null, 2));
    return;
  }

  if (videos.length === 0) {
    console.log("\n  No templates found.");
    console.log(
      "  Create a *.media.ts file, or copy one from monorepo examples/ (superimg init --example hello-world).\n",
    );
    return;
  }

  console.log("\n  Templates found:\n");

  // Short human label from the two axes (medium × animated).
  const typeLabel = (medium: string, animated: boolean): string =>
    medium === "svg" ? (animated ? "svg·anim" : "svg") : animated ? "video" : "image";

  const rows = videos.map((v) => ({
    shortName: v.shortName,
    type: v.collection
      ? `collection·${typeLabel(v.medium, v.animated)}`
      : v.kind === "interactive" ? "interactive" : typeLabel(v.medium, v.animated),
    config: v.config ?? "—",
    path: v.relativePath,
  }));

  const maxName = Math.max(4, ...rows.map((r) => r.shortName.length));
  const maxType = Math.max(4, ...rows.map((r) => r.type.length));
  const maxConfig = Math.max(6, ...rows.map((r) => r.config.length));
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${pad("Name", maxName)}  ${pad("Type", maxType)}  ${pad("Config", maxConfig)}  Path`);
  console.log(`  ${"-".repeat(maxName)}  ${"-".repeat(maxType)}  ${"-".repeat(maxConfig)}  ${"-".repeat(40)}`);

  for (const row of rows) {
    console.log(`  ${pad(row.shortName, maxName)}  ${pad(row.type, maxType)}  ${pad(row.config, maxConfig)}  ${row.path}`);
  }

  console.log("\n");
}

async function describeProjectMedia(
  projectRoot: string,
  mount: CliMediaInteractionSession["mount"],
  sources: readonly {
    sourceId: string;
    relativePath: string;
    sourceKind: "media-module" | "collection";
  }[],
): Promise<ListedMedia[]> {
  return Promise.all(sources.map(async (source) => {
    try {
      const description = await mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source: source.relativePath },
      }, {});
      return projectDescription(projectRoot, description);
    } catch {
      return failedDescription(projectRoot, source);
    }
  }));
}

function projectDescription(
  projectRoot: string,
  description: MediaSourceDescription,
): ListedMedia {
  const entrypoint = join(projectRoot, description.relativePath);
  const directory = dirname(entrypoint);
  const base = {
    name: description.sourceId,
    shortName: extractShortName(description.relativePath),
    relativePath: description.relativePath,
    entrypoint,
    hasLocalConfig: existsSync(join(directory, "_config.ts")),
  };
  const kind = description.sourceKind === "interactive"
    ? "interactive" as const
    : description.media === "svg"
      ? "svg" as const
      : !description.animated
        ? "image" as const
        : description.temporal === "loop"
          ? "loop" as const
          : "video" as const;
  return {
    ...base,
    medium: description.medium ?? "html" as const,
    animated: description.animated,
    kind,
    ...((description.temporal === "once" || description.temporal === "loop")
      ? { temporal: description.temporal }
      : {}),
    width: description.canvas.width,
    height: description.canvas.height,
    fps: description.fps,
    duration: description.duration,
    config: description.sourceKind === "interactive"
      ? "interactive"
      : `${description.canvas.width}x${description.canvas.height}${description.animated ? ` ${description.fps}fps` : ""}`,
    ...(description.sourceKind === "collection"
      ? { collection: { entries: description.collectionEntries ?? "provider" } }
      : {}),
    ...(description.variantIds.length
      ? { variants: description.variantIds.map((id) => ({ id })) }
      : {}),
    ...(description.editions.length
      ? { editions: description.editions.map((edition) => ({ ...edition })) }
      : {}),
    ...(description.fonts.length ? { fonts: [...description.fonts] } : {}),
  };
}

function failedDescription(
  projectRoot: string,
  source: {
    sourceId: string;
    relativePath: string;
    sourceKind: "media-module" | "collection";
  },
): ListedMedia {
  const entrypoint = join(projectRoot, source.relativePath);
  const directory = dirname(entrypoint);
  return {
    name: source.sourceId,
    shortName: extractShortName(source.relativePath),
    relativePath: source.relativePath,
    entrypoint,
    hasLocalConfig: existsSync(join(directory, "_config.ts")),
    medium: "html" as const,
    animated: false,
    kind: "image" as const,
    width: 1920,
    height: 1080,
    fps: 1,
    duration: 1,
    config: "⚠ parse failed",
  };
}
