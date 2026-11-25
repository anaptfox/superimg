import { resolveSceneTree, collectSceneDescriptions } from "@superimg/stdlib/tree";
//! resolveMediaIR — full-frame browser-free Media IR compiler.

import type {
  MediaIRAsset,
  MediaIRCapabilities,
  MediaIRCapabilityIssue,
  MediaIRMotion,
  MediaIRScene,
  MediaIRTrack,
  MediaIR,
  MediaCoordinates,
  JsonObject,
  Duration,
  TemplateModule,
  TemplateBundle,
  RenderOutput,
  MediaElement,
  Program,
  RetainedComposition,
} from "@superimg/types";
import {
  inferTemplateAnimated,
  isFontDeclaration,
  isGoogleFontDeclaration,
  throwIfExecutionCancelled,
} from "@superimg/types";
import { fontIrToken, overlayFontFaces, resolveRuntimeFonts, type ResolvedFont } from "../rendering/fonts.js";
import { createRenderContext } from "../rendering/create-render-context.js";
import { applyTemplateResolve, type ApplyTemplateResolveResult } from "../rendering/resolve-template.js";
import { resolveRuntimeTemplateInfo } from "../rendering/runtime-info.js";
import { MediaIRError } from "./pure/errors.js";
import { computeMediaIRHashes, hashBytes } from "./pure/serialize.js";
import { validateMediaIR } from "./pure/validate.js";
import { canonicalizeToJson } from "./pure/canonicalize.js";
import { selectBoundaryFrames } from "./pure/frames.js";
import { IrCollector } from "./instrument.js";
import { attachIrSink } from "./sink-symbol.js";
import { rleHashRuns } from "./hash-runs.js";
import { lowerRenderOutput } from "../rendering/lower-output.js";
import { textMeasurerForDeclarations } from "../rendering/text-measurer-declarations.js";
import { textMeasurerFromFaces } from "../rendering/text-measurer.js";
import { isMediaElement } from "@superimg/types";
import { resolveAudioTimeline } from "../shared/audio-resolve.js";
import { decideFrameLane } from "../rendering/render-frame.js";
import { createPreparedStdlibForTemplate } from "../shared/stdlib-capabilities.js";
import { prepareRuntimeCompositionMedia } from "../runtime/selection.js";
import {
  buildMotionsFromCollector,
  buildTracksFromCollector,
  buildScenesFromCollector,
  mapResolveMarkers,
} from "./build-from-collector.js";

export interface MediaIRFrameCapture {
  html: string;
  tree?: import("@superimg/types").MediaElement;
  /** Raster lane chosen for this sampled frame. */
  lane?: "svg" | "html";
}

export interface ResolveMediaIROptions {
  /** Internal operation-local result; preserves resolve markers without rerunning the hook. */
  preparedResolve?: ApplyTemplateResolveResult;
  data?: Record<string, unknown>;
  sourceId?: string;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  programHash?: string;
  /** Double-pass determinism check. */
  verify?: boolean;
  /**
   * Reject temporal helpers without author-provided stable IDs.
   * Normal evaluation is additive: anonymous helpers render and downgrade
   * capability instead of breaking existing templates.
   */
  strictIds?: boolean;
  /** Pre-inspected assets supplied by a host that can read local bytes. */
  additionalAssets?: MediaIRAsset[];
  additionalIssues?: MediaIRCapabilityIssue[];
  signal?: AbortSignal;
  onProgress?: (p: { frame: number; totalFrames: number }) => void;
  /** Yield every N frames (default 30). */
  yieldEvery?: number;
  explicitOverrides?: Partial<{ duration: Duration; width: number; height: number; fps: number }>;
  assetResolver?: (filename: string) => string;
  /** Directory for relative local font files. Defaults to the process cwd. */
  sourceDir?: string;
  /** Frames to snapshot raw `render()` HTML (pass 1 only). */
  captureFrames?: number[];
  /**
   * Progress values 0–1 to capture (mapped to frames after totalFrames is known).
   * Combined with captureFrames into one set.
   */
  captureProgresses?: number[];
}

export interface ResolveMediaIRResult {
  ir: MediaIR;
  template: TemplateModule;
  /** Post-resolve() effective data frozen into job.json. */
  data: Record<string, unknown>;
  /** Optional per-frame HTML captures (pass 1 only; not part of Media IR). */
  captures?: Map<number, MediaIRFrameCapture>;
}

/** Stable source identity: basename without extension (comparable across hosts). */
export function normalizeSourceId(idOrPath: string): string {
  const base = idOrPath.replace(/\\/g, "/").split("/").pop() ?? idOrPath;
  return base.replace(/\.(media\.)?(ts|js|tsx|jsx)$/i, "") || "template";
}

async function yieldTick(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

function assetKind(src: string): MediaIRAsset["kind"] {
  if (/\.(mp4|webm|mov|avi|mkv|flv|wmv)(?:[?#].*)?$/i.test(src)) return "video";
  if (/\.(mp3|wav|ogg|aac|m4a|flac|opus)(?:[?#].*)?$/i.test(src)) return "audio";
  if (/\.(png|jpe?g|gif|webp|svg|avif)(?:[?#].*)?$/i.test(src)) return "image";
  if (/\.(woff2?|ttf|otf)(?:[?#].*)?$/i.test(src)) return "font";
  return "other";
}

function isRemote(src: string): boolean {
  return /^(?:https?:)?\/\//i.test(src);
}

function assetKindFromMimeType(mimeType: string): MediaIRAsset["kind"] {
  const family = mimeType.trim().toLowerCase().split("/", 1)[0];
  if (family === "image" || family === "video" || family === "audio") return family;
  return "other";
}

interface PassResult {
  collector: IrCollector;
  scenes: MediaIRScene[];
  motions: Map<string, MediaIRMotion>;
  tracks: Map<string, MediaIRTrack>;
  markupFrames: { frame: number; hash: string }[];
  sceneFrames: { frame: number; hash: string }[];
  spatialFrames: { frame: number; scenes: import("@superimg/types").SceneSnapshot[] }[];
  issues: MediaIRCapabilityIssue[];
  captures: Map<number, MediaIRFrameCapture>;
}

function containsOpaqueHtml(node: MediaElement): boolean {
  if (node.type === "Html") return true;
  for (const child of node.children) {
    if (isMediaElement(child) && containsOpaqueHtml(child)) return true;
  }
  return false;
}

/** Public structure without author functions or runtime-only child objects. */
function compositionProgramSummary(
  program: Program,
  selectedRoutes: Readonly<Record<string, string>>,
  parentPath = "",
): JsonObject {
  const contentSummary = (content: import("@superimg/types").CompositionContent, path: string): JsonObject =>
    "op" in content
      ? compositionProgramSummary(content as Program, selectedRoutes, path)
      : "kind" in content && content.kind === "interactive"
        ? { kind: "interactive", media: "video", medium: "html", animated: true }
        : {
          kind: "media",
          media: content.media,
          medium: content.medium,
          animated: content.animated,
        };

  if (program.op === "choose") {
    const choicePath = parentPath || "root";
    return {
      op: "choose",
      selected: selectedRoutes[choicePath] ?? null,
      paths: Object.entries(program.paths).map(([id, content]) => {
        const path = parentPath ? `${parentPath}/${id}` : id;
        return {
          id,
          path,
          selected: selectedRoutes[choicePath] === id,
          content: contentSummary(content, path),
        };
      }),
    };
  }
  return {
    op: program.op,
    parts: program.parts.map((use) => {
      const path = parentPath ? `${parentPath}/${use.id}` : use.id;
      return {
        id: use.id,
        path,
        ...(use.hold !== undefined ? { hold: use.hold } : {}),
        ...(use.fit !== undefined ? { fit: use.fit } : {}),
        ...("rect" in use ? { rect: { ...use.rect } } : {}),
        content: contentSummary(use.content, path),
      };
    }),
  };
}

interface CompositionSegment {
  id: string;
  startFrame: number;
  endFrame: number;
  active: { path: string; held: boolean }[];
}

/** The IR scene lane is flat; overlapping occurrences stay visible in the extension. */
function compositionSegments(composition: RetainedComposition): CompositionSegment[] {
  const { leaves, totalFrames } = composition.schedule;
  const boundaries = new Set<number>([0, totalFrames]);
  for (const leaf of leaves) {
    boundaries.add(leaf.startFrame);
    boundaries.add(leaf.endFrame);
    if (leaf.contentEndFrame !== undefined) boundaries.add(leaf.contentEndFrame);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((startFrame, index) => {
    const endFrame = sorted[index + 1]!;
    const activeLeaves = leaves.filter((leaf) => leaf.startFrame <= startFrame && startFrame < leaf.endFrame);
    if (activeLeaves.length === 0) {
      throw new MediaIRError("invalid_range", `composition has no visible child at frame ${startFrame}`);
    }
    const solo = activeLeaves.length === 1 && activeLeaves[0]!.placement === undefined;
    const groupPath = activeLeaves.find((leaf) => leaf.placement)?.placement?.groupPath ?? "composition";
    return {
      id: solo ? activeLeaves[0]!.path : `${groupPath}@${startFrame}`,
      startFrame,
      endFrame,
      active: activeLeaves.map((leaf) => ({
        path: leaf.path,
        held: leaf.contentEndFrame !== undefined && startFrame >= leaf.contentEndFrame,
      })),
    };
  });
}

/**
 * Web bytes feed the IR font hash. Native bytes feed the measurer.
 * One unreadable file does not drop a sibling face. A browser-decodable
 * face whose native unpack fails becomes one `font_metrics` warning.
 */
async function resolveDeclaredFonts(
  fonts: readonly unknown[] | undefined,
  options: { signal?: AbortSignal; sourceDir?: string },
): Promise<{
  measurer: Awaited<ReturnType<typeof textMeasurerForDeclarations>>;
  issues: MediaIRCapabilityIssue[];
  bytesByToken: ReadonlyMap<string, Uint8Array>;
}> {
  const shared = {
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(options.sourceDir !== undefined ? { sourceDir: options.sourceDir } : {}),
  };
  const declarations = fonts ?? [];
  const local = declarations.filter(isFontDeclaration);
  if (local.length === 0) {
    return {
      measurer: await textMeasurerForDeclarations(declarations, options.signal),
      issues: [],
      bytesByToken: new Map(),
    };
  }
  const bytesByToken = new Map<string, Uint8Array>();
  const nativeFaces: ResolvedFont[] = [];
  const issues: MediaIRCapabilityIssue[] = [];
  let nativeFailure: string | undefined;
  let webReadable = 0;
  for (const font of local) {
    const web = await resolveRuntimeFonts([font], { ...shared, format: "web", defaultFonts: false });
    const webFace = web.faces[0];
    if (webFace) {
      webReadable += 1;
      bytesByToken.set(fontIrToken(font), webFace.data);
    }
    const native = await resolveRuntimeFonts([font], { ...shared, format: "native", defaultFonts: false });
    const nativeFace = native.faces[0];
    if (nativeFace) nativeFaces.push(nativeFace);
    else if (webFace && nativeFailure === undefined && native.errors[0]) nativeFailure = native.errors[0].message;
  }
  if (webReadable > 0 && nativeFaces.length < webReadable && nativeFailure !== undefined) {
    issues.push({ code: "font_metrics", message: nativeFailure });
  }
  const base = await resolveRuntimeFonts(declarations.filter(isGoogleFontDeclaration), shared);
  return {
    measurer: textMeasurerFromFaces(overlayFontFaces(base.faces, nativeFaces)),
    issues,
    bytesByToken,
  };
}

export async function resolveMediaIR(
  templateInput: TemplateModule,
  options: ResolveMediaIROptions = {},
): Promise<ResolveMediaIRResult> {
  throwIfExecutionCancelled(options);

  const animationMode = templateInput.config?.mode === "animation";

  const applied = options.preparedResolve ?? await applyTemplateResolve(templateInput, {
    ...(options.data !== undefined ? { data: options.data as JsonObject } : {}),
    ...(options.explicitOverrides !== undefined
      ? { overrides: options.explicitOverrides }
      : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  let template = applied.template;
  let data = applied.data as Record<string, unknown>;
  const initialRuntime = resolveRuntimeTemplateInfo(template);
  const preparedComposition = await prepareRuntimeCompositionMedia(
    template as unknown as import("@superimg/types").DeterministicMediaDefinition<JsonObject>,
    data as JsonObject,
    {
      size: { width: initialRuntime.width, height: initialRuntime.height },
      fps: initialRuntime.fps,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    },
  );
  if (preparedComposition !== undefined) {
    template = preparedComposition.media as unknown as TemplateModule;
    data = preparedComposition.data;
  }
  const composition = "composition" in template
    ? template.composition as RetainedComposition | undefined
    : undefined;
  const preparedStdlib = await createPreparedStdlibForTemplate(template);
  const declaredFonts = await resolveDeclaredFonts(template.config?.fonts, {
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(options.sourceDir !== undefined ? { sourceDir: options.sourceDir } : {}),
  });
  const measurer = declaredFonts.measurer;
  const sourceId = normalizeSourceId(options.sourceId ?? "template");
  const coordinates: MediaCoordinates = {
    sourceId,
    ...(options.entryId !== undefined ? { entryId: options.entryId } : {}),
    variantId: options.variantId ?? "default",
    editionId: options.editionId ?? "default",
  };
  const programHash = options.programHash ?? hashBytes("inline-program");

  const config = template.config;
  const medium = (template.medium === "svg" ? "svg" : "html") as "html" | "svg";
  // The IR clock/canvas ARE the runtime's — one derivation, no parallel copy.
  // The Player rejects any mediaIR whose clock differs from the live session
  // (IR_CLOCK_MISMATCH), so this must come from resolveRuntimeTemplateInfo.
  const animated = inferTemplateAnimated(template);
  const runtime = resolveRuntimeTemplateInfo(template);
  const { width, height, fps, totalFrames } = runtime;
  const segments = composition ? compositionSegments(composition) : undefined;
  // Stills are timeless in IR (validator: totalFrames === max(1, ceil(d*fps))),
  // so keep durationSeconds 0 even though the runtime plays a 1s still.
  const durationSeconds = animated ? runtime.duration : 0;

  const captureSet = (() => {
    const set = new Set<number>();
    if (options.captureFrames) {
      for (const f of options.captureFrames) {
        const fi = Math.floor(f);
        if (fi >= 0 && fi < totalFrames) set.add(fi);
      }
    }
    if (options.captureProgresses) {
      for (const p of options.captureProgresses) {
        const clamped = Math.max(0, Math.min(1, p));
        const fi =
          totalFrames <= 1
            ? 0
            : Math.min(totalFrames - 1, Math.round(clamped * (totalFrames - 1)));
        set.add(fi);
      }
    }
    // Compilation already evaluates every frame. If the caller requested
    // captures, retain both sides of each composition segment boundary.
    if (set.size > 0 && segments) {
      for (const frame of selectBoundaryFrames(segments, totalFrames)) set.add(frame);
    }
    return set.size > 0 ? set : null;
  })();

  const runPass = async (collectCaptures: boolean): Promise<PassResult> => {
    const collector = new IrCollector();
    const markupFrames: { frame: number; hash: string }[] = [];
    const sceneFrames: { frame: number; hash: string }[] = [];
    const spatialFrames: { frame: number; scenes: import("@superimg/types").SceneSnapshot[] }[] = [];
    const captures = new Map<number, MediaIRFrameCapture>();
    let hasOpaqueVisualRegion = false;
    const yieldEvery = options.yieldEvery ?? 30;
    let segmentIndex = 0;

    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfExecutionCancelled(options);
      if (frame > 0 && frame % yieldEvery === 0) await yieldTick();
      options.onProgress?.({ frame, totalFrames });

      while (segments && segmentIndex < segments.length - 1 && frame >= segments[segmentIndex]!.endFrame) segmentIndex++;
      const segment = segments?.[segmentIndex];
      const sceneId = segment?.id ?? "default";
      const sceneStartFrame = segment?.startFrame ?? 0;
      const sceneTotalFrames = segment ? segment.endFrame - segment.startFrame : totalFrames;

      const frameSink = collector.sink({
        strictIds: options.strictIds === true,
        sceneId,
        sceneStartFrame,
        totalFrames: sceneTotalFrames,
        frame,
      });

      const ctx = createRenderContext(
        frame,
        fps,
        totalFrames,
        width,
        height,
        data,
        {},
        options.assetResolver,
        config?.width,
        frameSink,
        { sceneId, sceneIndex: segmentIndex, sceneStartFrame },
        preparedStdlib,
      );
      attachIrSink(ctx, frameSink);

      let html: string;
      let output: RenderOutput;
      try {
        output = resolveSceneTree(template.render(ctx), segments ? { prefix: sceneId } : {});
        html = lowerRenderOutput(output, medium, {
          width,
          height,
          ...(measurer !== undefined ? { measurer } : {}),
        });
        if (containsOpaqueHtml(output)) hasOpaqueVisualRegion = true;
      } catch (e) {
        const err = e as Error;
        const msg = err.message ?? String(e);
        if (
          msg.includes("missing required id") ||
          msg.includes("missing required itemIds") ||
          msg.includes("(Media IR)")
        ) {
          throw new MediaIRError("missing_id", msg, { frame });
        }
        throw e;
      }

      const markupHash = hashBytes(html);
      const spatial = collectSceneDescriptions(output);
      if (spatial.length) spatialFrames.push({ frame, scenes: [...spatial] });
      const sceneHash = hashBytes(spatial.length ? canonicalizeToJson({ sceneId, spatial }) : sceneId);
      markupFrames.push({ frame, hash: markupHash });
      sceneFrames.push({ frame, hash: sceneHash });

      if (collectCaptures && captureSet?.has(frame)) {
        const decision = decideFrameLane(
          template,
          output,
          { width, height, ...(measurer !== undefined ? { measurer } : {}) },
          {
            ...(config?.background !== undefined ? { background: config.background } : {}),
            ...(config?.watermark !== undefined ? { watermark: config.watermark } : {}),
          },
        );
        captures.set(frame, {
          html,
          tree: output,
          lane: decision.lane,
        });
      }
    }

    const { motions, issues: motionIssues } = buildMotionsFromCollector(
      collector,
      totalFrames,
    );
    const issues = [
      ...collector.issues,
      ...motionIssues,
      ...declaredFonts.issues,
      ...(options.additionalIssues ?? []),
      ...(hasOpaqueVisualRegion
        ? [
            {
              code: "opaque_visual_region",
              message:
                "The MediaElement tree contains Html(), so that boxed visual region remains opaque to semantic inspection",
            },
          ]
        : []),
      ...(animationMode
        ? [
            {
              code: "animation_mode_opaque",
              message:
                'mode: "animation" uses browser fake-clock CSS; temporal behavior is opaque',
            },
          ]
        : []),
    ];
    const tracks = buildTracksFromCollector(collector, totalFrames);
    const globalMarkers = mapResolveMarkers(
      applied.resolved?.markers ?? [],
      fps,
      totalFrames,
    );
    const observedScenes = buildScenesFromCollector(
      collector,
      totalFrames,
      globalMarkers,
    );
    const scenes: MediaIRScene[] = segments
      ? segments.map((segment, index) => ({
          id: segment.id,
          index,
          range: { startFrame: segment.startFrame, endFrame: segment.endFrame },
          phases: segment.active.length === 1 && !segment.id.includes("@")
            ? observedScenes.find((scene) => scene.id === segment.id)?.phases ?? []
            : [],
          markers: globalMarkers.filter((marker) => marker.frame >= segment.startFrame && marker.frame < segment.endFrame),
          transitions: [],
        }))
      : observedScenes;

    if (segments) {
      const flatSceneAt = (frame: number) => segments.find((segment) => frame >= segment.startFrame && frame < segment.endFrame)?.id ?? segments.at(-1)!.id;
      for (const track of tracks.values()) track.sceneId = flatSceneAt(track.range.startFrame);
      for (const motion of motions.values()) motion.sceneId = flatSceneAt(motion.enter.startFrame);
    }
    const audio = resolveAudioTimeline(config?.audio, {
      fps,
      videoDurationSeconds: durationSeconds,
      scenes: scenes.map((scene) => ({
        id: scene.id,
        startSeconds: scene.range.startFrame / fps,
        endSeconds: scene.range.endFrame / fps,
      })),
    });
    if (audio) {
      for (const clip of audio.clips) {
        const startFrame = Math.max(
          0,
          Math.min(totalFrames - 1, Math.round(clip.atSeconds * fps)),
        );
        const endFrame = Math.max(
          startFrame + 1,
          Math.min(
            totalFrames,
            Math.ceil((clip.atSeconds + clip.placementDurationSeconds) * fps),
          ),
        );
        const sceneId =
          scenes.find(
            (scene) =>
              startFrame >= scene.range.startFrame &&
              startFrame < scene.range.endFrame,
          )?.id ?? scenes[0]?.id ?? "default";
        tracks.set(`audio::${clip.id}`, {
          id: `audio::${clip.id}`,
          kind: "audio",
          sceneId,
          ...(clip.label !== undefined ? { label: clip.label } : {}),
          range: { startFrame, endFrame },
          role: clip.role,
          src: clip.src,
          meta: {
            loop: clip.loop,
            volume: clip.volume,
            showInTimeline: clip.showInTimeline,
            startSeconds: clip.atSeconds,
            endSeconds: clip.atSeconds + clip.placementDurationSeconds,
            trimInSeconds: clip.trimInSeconds,
            trimOutSeconds: clip.trimOutSeconds,
            fadeInSeconds: clip.fadeInSeconds,
            fadeOutSeconds: clip.fadeOutSeconds,
          },
        });
        if (clip.transcript && clip.transcript.length > 0) {
          tracks.set(`transcript::${clip.id}`, {
            id: `transcript::${clip.id}`,
            kind: "transcript",
            sceneId,
            range: { startFrame, endFrame },
            meta: { wordCount: clip.transcript.length },
          });
        }
      }
    }

    return {
      collector,
      scenes,
      motions,
      tracks,
      markupFrames,
      sceneFrames,
      spatialFrames,
      issues,
      captures,
    };
  };

  // Captures only on pass 1 (never on verify pass 2; never hashed/serialized).
  const pass1 = await runPass(true);

  if (options.verify) {
    const pass2 = await runPass(false);
    const s1 = canonicalizeToJson({
      markup: pass1.markupFrames,
      scene: pass1.sceneFrames,
      motions: [...pass1.motions.values()],
      scenes: pass1.scenes,
      tracks: [...pass1.tracks.values()],
      issues: pass1.issues,
    });
    const s2 = canonicalizeToJson({
      markup: pass2.markupFrames,
      scene: pass2.sceneFrames,
      motions: [...pass2.motions.values()],
      scenes: pass2.scenes,
      tracks: [...pass2.tracks.values()],
      issues: pass2.issues,
    });
    if (s1 !== s2) {
      let divergeFrame = 0;
      for (let i = 0; i < pass1.markupFrames.length; i++) {
        if (
          pass1.markupFrames[i]?.hash !== pass2.markupFrames[i]?.hash ||
          pass1.sceneFrames[i]?.hash !== pass2.sceneFrames[i]?.hash
        ) {
          divergeFrame = i;
          break;
        }
      }
      throw new MediaIRError(
        "nondeterministic",
        `Media IR verification failed: non-deterministic at frame ${divergeFrame}`,
        { frame: divergeFrame },
      );
    }
  }

  const hasSampledMotion = [...pass1.motions.values()].some((m) => m.kind === "sampled");
  const hasAnonymousTemporal = pass1.issues.some((i) => i.code === "anonymous_id");
  const hasInconsistent = pass1.issues.some((i) => i.code === "inconsistent_motion");
  const motionCap = pass1.motions.size === 0
    ? hasAnonymousTemporal
      ? "sampled"
      : "none"
    : hasSampledMotion || hasInconsistent
      ? "sampled"
      : "declarative";

  const remoteStyles = (template.config?.stylesheets ?? []).some(
    (s) => typeof s === "string" && /^https?:\/\//i.test(s),
  );
  const assetsById = new Map<string, MediaIRAsset>();
  const addAsset = (asset: MediaIRAsset) => {
    assetsById.set(asset.id, asset);
  };
  for (const [key, declaration] of Object.entries(config?.assets ?? {})) {
    if ("url" in declaration) {
      const src = String(declaration.url);
      addAsset({
        id: `asset:${key}`,
        kind: declaration.type ?? assetKind(src),
        src,
        remote: isRemote(src),
      });
    } else {
      const contentHash = hashBytes(declaration.bytes);
      addAsset({
        id: `asset:${key}`,
        kind: declaration.type ?? assetKindFromMimeType(declaration.mimeType),
        src: `bytes:${contentHash}`,
        remote: false,
        contentHash,
      });
    }
  }
  if (config?.background) {
    const src =
      typeof config.background === "string"
        ? config.background
        : config.background.src;
    if (!/^(?:#|rgba?\(|hsla?\()/i.test(src)) {
      addAsset({
        id: "background",
        kind: assetKind(src),
        src,
        remote: isRemote(src),
      });
    }
  }
  if (
    typeof config?.watermark === "object" &&
    config.watermark.type === "image"
  ) {
    addAsset({
      id: "watermark",
      kind: "image",
      src: config.watermark.content,
      remote: isRemote(config.watermark.content),
    });
  }
  for (const font of config?.fonts ?? []) {
    if (!isGoogleFontDeclaration(font) && !isFontDeclaration(font)) continue;
    const token = fontIrToken(font);
    const remote = isGoogleFontDeclaration(font)
      || (typeof font.src === "string" && /^https?:\/\//i.test(font.src));
    const bytes = declaredFonts.bytesByToken.get(token);
    addAsset({
      id: `font:${token}`,
      kind: "font",
      src: token,
      remote,
      ...(bytes !== undefined ? { contentHash: hashBytes(bytes) } : {}),
    });
  }
  if (config?.tailwind) {
    addAsset({
      id: "tailwind:play-cdn",
      kind: "other",
      src: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
      remote: true,
    });
  }
  const audio = resolveAudioTimeline(config?.audio, {
    fps,
    videoDurationSeconds: durationSeconds,
    scenes: pass1.scenes.map((scene) => ({
      id: scene.id,
      startSeconds: scene.range.startFrame / fps,
      endSeconds: scene.range.endFrame / fps,
    })),
  });
  for (const clip of audio?.clips ?? []) {
    addAsset({
      id: `audio:${clip.id}`,
      kind: "audio",
      src: clip.src,
      remote: isRemote(clip.src),
    });
  }
  for (const [id, ev] of pass1.collector.videoSyncs) {
    const e0 = ev[0]!;
    addAsset({
      id,
      kind: "video",
      src: e0.src,
      remote: isRemote(e0.src),
    });
  }
  for (const asset of options.additionalAssets ?? []) addAsset(asset);
  const assets = [...assetsById.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const asset of assets) {
    if (!asset.contentHash && asset.src.startsWith("data:")) {
      asset.contentHash = hashBytes(asset.src);
    }
    if (!asset.remote && !asset.contentHash) {
      const normalizedSource = asset.src.replace(/\\/g, "/").replace(/^\.\/+/, "");
      const inspectedCandidates = assets.filter(
        (candidate) =>
          candidate !== asset &&
          candidate.contentHash !== undefined &&
          !candidate.remote,
      );
      const exactMatches = inspectedCandidates.filter(
        (candidate) =>
          candidate.src.replace(/\\/g, "/").replace(/^\.\/+/, "") ===
          normalizedSource,
      );
      const basenameMatches = inspectedCandidates.filter(
        (candidate) =>
          candidate.src.replace(/\\/g, "/").split("/").pop() ===
          normalizedSource.split("/").pop(),
      );
      const matchingInspected =
        exactMatches.length === 1
          ? exactMatches[0]
          : exactMatches.length === 0 && basenameMatches.length === 1
            ? basenameMatches[0]
            : undefined;
      if (matchingInspected?.contentHash) {
        asset.contentHash = matchingInspected.contentHash;
      }
    }
    if (
      !asset.remote &&
      !asset.contentHash &&
      !pass1.issues.some(
        (issue) => issue.code === "missing_asset" && issue.id === asset.id,
      )
    ) {
      pass1.issues.push({
        code: "missing_asset",
        message: `Local asset "${asset.src}" was referenced but its bytes were not available to the IR host`,
        id: asset.id,
      });
    }
  }
  const networkRequired =
    remoteStyles || Boolean(config?.tailwind) || assets.some((a) => a.remote);
  const missingAssets = pass1.issues.some((issue) => issue.code === "missing_asset");

  const capabilities: MediaIRCapabilities = {
    temporal: animationMode
      ? "opaque"
      : hasAnonymousTemporal
        ? "sampled"
        : "canonical",
    motion: motionCap,
    visual: "tree",
    portability: missingAssets
      ? "incomplete"
      : networkRequired
        ? "network-required"
        : "self-contained",
    determinism: options.verify ? "verified" : "unverified",
    issues: pass1.issues,
  };

  const draft: Omit<MediaIR, "hashes"> & { hashes?: MediaIR["hashes"] } = {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: coordinates,
    medium,
    animated,
    canvas: { width, height },
    renderConfig: {
      fonts: (config?.fonts ?? []).flatMap((font) =>
        isGoogleFontDeclaration(font) || isFontDeclaration(font) ? [fontIrToken(font)] : [],
      ),
      inlineCss: [...(config?.inlineCss ?? [])],
      stylesheets: [...(config?.stylesheets ?? [])],
      tailwind: (config?.tailwind ?? false) as MediaIR["renderConfig"]["tailwind"],
      background: (config?.background ?? null) as MediaIR["renderConfig"]["background"],
      watermark: (config?.watermark ?? null) as MediaIR["renderConfig"]["watermark"],
      readiness: (config?.readiness ?? null) as MediaIR["renderConfig"]["readiness"],
      mode: config?.mode ?? "frame",
    },
    clock: { fps, durationSeconds, totalFrames },
    capabilities,
    provenance: {
      programHash,
      sourceId,
      compiler: "superimg",
      compilerVersion: 0,
    },
    scenes: pass1.scenes,
    tracks: [...pass1.tracks.values()].sort((a, b) => a.id.localeCompare(b.id)),
    motions: [...pass1.motions.values()].sort((a, b) => a.id.localeCompare(b.id)),
    assets,
    observations: {
      markupRuns: rleHashRuns(pass1.markupFrames),
      sceneRuns: rleHashRuns(pass1.sceneFrames),
    },
    extensions: composition
      ? {
          "superimg.composition": {
            schemaVersion: 0,
            payload: {
              program: compositionProgramSummary(composition.program, composition.schedule.selectedRoutes ?? {}),
              outputSize: { ...composition.outputSize },
              schedule: {
                fps: composition.schedule.fps,
                totalFrames: composition.schedule.totalFrames,
                selectedRoutes: { ...(composition.schedule.selectedRoutes ?? {}) },
                leaves: composition.schedule.leaves.map(({ placementChain, ...leaf }) => ({
                  ...leaf,
                  ...(placementChain
                    ? { placementChain: placementChain.map((placement) => ({
                        ...placement,
                        rect: { ...placement.rect },
                      })) }
                    : {}),
                })),
              },
              segments: segments?.map((segment) => ({
                id: segment.id,
                range: { startFrame: segment.startFrame, endFrame: segment.endFrame },
                active: segment.active.map((child) => ({ ...child })),
              })) ?? [],
            },
          },
        }
      : {},
  };

  if (pass1.spatialFrames.length) {
    const ranges: { startFrame: number; endFrame: number; scenes: unknown }[] = [];
    for (const record of pass1.spatialFrames) {
      const previous = ranges.at(-1);
      if (previous && previous.endFrame === record.frame && canonicalizeToJson(previous.scenes) === canonicalizeToJson(record.scenes)) previous.endFrame++;
      else ranges.push({ startFrame: record.frame, endFrame: record.frame + 1, scenes: record.scenes });
    }
    draft.extensions["superimg/scene"] = { schemaVersion: 0, payload: JSON.parse(JSON.stringify({ ranges })) };
  }
  const hashes = computeMediaIRHashes(draft as MediaIR, programHash);
  const ir = validateMediaIR({ ...draft, hashes });

  return {
    ir,
    template,
    data,
    ...(pass1.captures.size > 0 ? { captures: pass1.captures } : {}),
  };
}

/** Convenience: resolve from a pre-compiled bundle code string. */
export async function resolveMediaIRFromBundle(
  bundle: TemplateBundle,
  options: ResolveMediaIROptions = {},
): Promise<ResolveMediaIRResult> {
  const { compileTemplate } = await import("../rendering/compiler.js");
  const result = compileTemplate(bundle);
  if (result.error || !result.media) {
    throw result.error ?? new Error("Template compilation failed");
  }
  return resolveMediaIR(result.media, {
    ...options,
    programHash: options.programHash ?? hashBytes(bundle.code),
  });
}
