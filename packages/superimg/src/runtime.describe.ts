import type { MediaValue, Program } from "@superimg/types";
import { probeDirectorPhases, resolveRuntimeTemplateInfo } from "@superimg/core";

export type MediaDescription =
  | { readonly kind: "program"; readonly operation: Program["op"] }
  | { readonly kind: "interactive"; readonly size: Readonly<{ width: number; height: number }> | undefined }
  | {
    readonly kind: "media" | "collection";
    readonly media: string;
    readonly canvas: Readonly<{ width: number; height: number }>;
    readonly clock: Readonly<{ fps: number; durationSeconds: number; totalFrames: number }>;
    readonly phases?: readonly Readonly<{ name: string; startSeconds: number; endSeconds: number }>[];
    readonly variants: readonly string[];
    readonly editions: readonly Readonly<{ id: string; width: number; height: number }>[];
    readonly retainedProgram: Program | undefined;
  };

/** Describe an authored value. Opt-in phase probing calls render once with sample data. */
export function describeMedia(value: MediaValue | Program, options: { probePhases?: boolean } = {}): MediaDescription {
  if ("op" in value) return { kind: "program", operation: value.op };
  if (value.kind === "interactive") return { kind: "interactive", size: value.size };
  const media = value.kind === "collection" ? value.media : value;
  const runtime = resolveRuntimeTemplateInfo(media);
  const phases = options.probePhases && runtime.isAnimated && !media.composition
    ? (probeDirectorPhases(media, { ...runtime, durationSeconds: runtime.duration }) ?? []).map(phase => ({
      name: phase.name,
      startSeconds: phase.start * runtime.duration,
      endSeconds: phase.end * runtime.duration,
    }))
    : undefined;
  return {
    kind: value.kind,
    media: media.media,
    canvas: { width: runtime.width, height: runtime.height },
    clock: { fps: runtime.fps, durationSeconds: runtime.duration, totalFrames: runtime.totalFrames },
    ...(phases === undefined ? {} : { phases }),
    variants: Object.keys(media.variants ?? {}),
    editions: Object.entries(media.editions ?? {}).map(([id, edition]) => ({ id, ...edition.size })),
    retainedProgram: media.composition?.program,
  };
}
