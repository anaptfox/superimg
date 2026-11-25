//! Synchronous, source-only rebasing for retained composition programs.

import type { AudioClip, CompositionContent, CompositionMedia, FontInput, Program, Use } from "@superimg/types";
import { portableChildResourcesFor, resolveCompositionSource, validateCompositionSourceBase } from "./resources.js";

export type CompositionSourceBases = Readonly<Record<string, string | URL>>;

function isProgram(value: CompositionContent): value is Program {
  return typeof value === "object" && value !== null && "op" in value;
}

function rebaseMedia(media: CompositionMedia, path: string, sourceBase: string | URL | undefined): CompositionMedia {
  if (!media.config) throw new TypeError(`composition: ${path}: child must declare a config`);
  const config = media.config;
  const assets = Object.fromEntries(Object.entries(config.assets ?? {}).map(([name, declaration]) => {
    if ("bytes" in declaration) return [name, declaration];
    return [name, {
      ...declaration,
      url: resolveCompositionSource(String(declaration.url), sourceBase, path, name, "asset"),
    }];
  }));
  const fonts = config.fonts?.map((font) => {
    if ("kind" in font || typeof font.src !== "string") return font;
    return { ...font, src: resolveCompositionSource(font.src, sourceBase, path, font.family, "font") };
  }) as readonly FontInput[] | undefined;
  const mapClip = (clip: AudioClip): AudioClip => {
    const src = resolveCompositionSource(clip.src, sourceBase, path, clip.id ?? "clip", "audio");
    return { ...clip, src, ...(clip.source?.kind === "file" ? { source: { ...clip.source, src } } : {}) };
  };
  const audio = config.audio;
  const resolvedAudio = Array.isArray(audio)
    ? audio.map(mapClip)
    : audio && typeof audio === "object" && "clips" in audio
      ? { ...audio, clips: audio.clips.map(mapClip) }
      : audio ? mapClip(audio as AudioClip) : undefined;
  const rebased = Object.freeze({
    ...media,
    config: Object.freeze({
      ...config,
      ...(config.assets ? { assets: Object.freeze(assets) } : {}),
      ...(fonts ? { fonts: Object.freeze(fonts) } : {}),
      ...(resolvedAudio ? { audio: resolvedAudio } : {}),
    }),
  }) as CompositionMedia;
  // This validates absolute URLs and byte declarations after rebasing.
  portableChildResourcesFor(rebased, path);
  return rebased;
}

/**
 * Clone a retained Program and rebase relative resource declarations at each
 * leaf occurrence. Bases are explicit absolute HTTP(S)/file URLs keyed by the
 * same qualified occurrence paths used by `time()`.
 */
export function rebaseCompositionSources(program: Program, sourceBases: CompositionSourceBases): Program {
  const active = new Set<object>();
  const visited = new Set<string>();

  function visit(current: Program, parentPath: string): Program {
    if (active.has(current)) throw new TypeError(`composition: ${parentPath || "root"}: cyclic Program graph`);
    active.add(current);
    try {
      if (current.op === "choose") {
        const paths: Record<string, CompositionContent> = {};
        for (const [id, child] of Object.entries(current.paths)) {
          const path = parentPath ? `${parentPath}/${id}` : id;
          paths[id] = rebaseContent(child, path);
        }
        return Object.freeze({ ...current, paths: Object.freeze(paths) });
      }
      const parts: Use[] = current.parts.map((use) => {
        const path = parentPath ? `${parentPath}/${use.id}` : use.id;
        return Object.freeze({ ...use, content: rebaseContent(use.content, path) });
      });
      return Object.freeze({ ...current, parts: Object.freeze(parts) }) as Program;
    } finally {
      active.delete(current);
    }
  }

  function rebaseContent(content: CompositionContent, path: string): CompositionContent {
    if (isProgram(content)) return visit(content, path);
    if ("kind" in content && content.kind === "interactive") {
      visited.add(path);
      return content;
    }
    visited.add(path);
    const sourceBase = sourceBases[path];
    if (sourceBase !== undefined) validateCompositionSourceBase(sourceBase, path);
    return rebaseMedia(content, path, sourceBase);
  }

  const rebased = visit(program, "");
  for (const path of Object.keys(sourceBases)) {
    if (!visited.has(path)) throw new TypeError(`composition: sourceBase path ${JSON.stringify(path)} does not identify a leaf occurrence`);
    validateCompositionSourceBase(sourceBases[path]!, path);
  }
  return rebased;
}
