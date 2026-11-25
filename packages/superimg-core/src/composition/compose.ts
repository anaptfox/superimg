//! Scene composition - combine multiple templates into a single video

import type {
  AnimatedTemplateModule,
  FontInput,
  MediaDefinition,
  RenderContext,
  TemplateConfig,
  TemplateModule,
  SceneDefinition,
  ResolvedTransition,
  Duration,
  EasingName,
} from "@superimg/types";
import { isGoogleFontDeclaration } from "@superimg/types";
import { parseDuration } from "../shared/utils.js";
import { collectComposeAudio } from "../shared/assets.js";
import { bindStdTiming } from "../shared/bind-std-timing.js";
import { createTimeline } from "../shared/create-timeline.js";
import { createDirector, type DirectorContext } from "@superimg/stdlib/director";
import { createTrack } from "@superimg/stdlib/track";
import { renderWithTransition, renderSvgWithTransition } from "./transitions.js";
import type { Medium, RenderOutput } from "@superimg/types";
import { attachIrSink, getIrSink } from "../ir/sink-symbol.js";
import { lowerRenderOutput } from "../rendering/lower-output.js";
import { Html, Vector } from "@superimg/stdlib/tree";
import { uniqueNativeModuleSets } from "./native-modules.js";

interface ResolvedComposeScene<TData extends object> {
  id: string;
  label?: string;
  index: number;
  template: ComposableMedia<TData>;
  startFrame: number;
  endFrame: number;
  totalFrames: number;
  duration: number;
  data: TData;
  enterTransition?: ResolvedTransition;
  exitTransition?: ResolvedTransition;
}

type ComposableMedia<TData extends object> =
  | AnimatedTemplateModule<TData, "html">
  | AnimatedTemplateModule<TData, "svg">;

type ComposeSceneDefinition<TData extends object> = Omit<
  SceneDefinition<TData>,
  "template"
> & { template: ComposableMedia<TData> };

function isSceneDefinition<TData extends object>(
  item: ComposableMedia<TData> | ComposeSceneDefinition<TData>,
): item is ComposeSceneDefinition<TData> {
  return "template" in item && typeof (item as ComposeSceneDefinition<TData>).template === "object";
}

function normalizeToSceneDefinitions<TData extends object>(
  items: (ComposableMedia<TData> | ComposeSceneDefinition<TData>)[],
): ComposeSceneDefinition<TData>[] {
  return items.map((item) =>
    isSceneDefinition(item)
      ? item
      : { template: item }
  );
}

function resolveTransition(
  t: { type: string; duration: Duration; easing?: EasingName } | undefined,
  fps: number
): ResolvedTransition | undefined {
  if (!t || t.type === "none") return undefined;
  const durationSeconds = parseDuration(
    t.duration as string | number,
    "transition.duration",
    fps
  );
  return {
    type: t.type as ResolvedTransition["type"],
    duration: durationSeconds,
    ...(t.easing !== undefined ? { easing: t.easing } : {}),
  };
}

/**
 * Compose multiple animated media programs into a single video.
 * Each item may be a media definition or an object carrying scene metadata.
 *
 * @param scenes - Animated media programs, optionally with scene metadata
 * Returns an ordinary video definition. Scene selection and transitions are
 * implementation details of its pure render function.
 */
export function compose<TData extends object = Record<string, unknown>>(
  scenes: (ComposableMedia<TData> | ComposeSceneDefinition<TData>)[],
  options?: { config?: TemplateConfig },
): MediaDefinition<TData, "video", RenderContext<TData>>;
/**
 * Heterogeneous scenes keep their own data and samples. There is no common
 * root data contract; use the homogeneous overload for shared overrides.
 */
export function compose<TData extends object[]>(
  scenes: [...{ [K in keyof TData]: ComposableMedia<TData[K]> | ComposeSceneDefinition<TData[K]> }],
  options?: { config?: TemplateConfig },
): MediaDefinition<Record<string, never>, "video", RenderContext<Record<string, never>>>;
export function compose<TData extends object = Record<string, unknown>>(
  scenes: (ComposableMedia<TData> | ComposeSceneDefinition<TData>)[],
  options?: { config?: TemplateConfig },
): MediaDefinition<TData, "video", RenderContext<TData>> {
  if (scenes.length === 0) {
    throw new Error("compose() requires at least one scene");
  }

  const definitions = normalizeToSceneDefinitions(scenes);
  const mediums = new Set(definitions.map((d) => d.template.medium ?? "html"));
  if (mediums.size > 1) {
    throw new Error(
      `compose() requires all scenes to share the same medium (got: ${[...mediums].join(", ")})`,
    );
  }
  const medium = (mediums.values().next().value ?? "html") as Medium;

  const mergedConfig = mergeConfigs(
    definitions.map((d) => d.template),
    options?.config,
  );
  const fps = mergedConfig.fps ?? 30;
  const width = mergedConfig.width ?? 1920;
  const height = mergedConfig.height ?? 1080;

  const resolvedScenes: ResolvedComposeScene<TData>[] = [];
  let currentFrame = 0;

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i]!;
    const template = def.template;
    const cfg = template.config;

    // Duration: scene def > template config > default
    const durationSource = def.duration ?? cfg?.duration;
    const durationSeconds = parseDuration(
      durationSource,
      `scene[${i}].duration`,
      fps
    );
    const totalFrames = Math.round(durationSeconds * fps);

    const id = def.id ?? `scene-${i}`;
    const enterTransition = resolveTransition(def.enter, fps);
    const exitTransition = resolveTransition(def.exit, fps);

    resolvedScenes.push({
      id,
      ...(def.label !== undefined ? { label: def.label } : {}),
      index: i,
      template,
      startFrame: currentFrame,
      endFrame: currentFrame + totalFrames,
      totalFrames,
      duration: durationSeconds,
      data: { ...template.sample, ...def.data } as TData,
      ...(enterTransition !== undefined ? { enterTransition } : {}),
      ...(exitTransition !== undefined ? { exitTransition } : {}),
    });
    currentFrame += totalFrames;
  }

  const totalFrames = currentFrame;
  const totalDurationSeconds = totalFrames / fps;

  const frameToSceneIndex = new Uint16Array(totalFrames);
  for (const s of resolvedScenes) {
    for (let f = s.startFrame; f < s.endFrame; f++) {
      frameToSceneIndex[f] = s.index;
    }
  }

  const collectedAudio = bakeComposeSceneAudio(
    collectComposeAudio(definitions, mergedConfig.audio),
    resolvedScenes,
    fps,
  );

  const config: TemplateConfig = {
    ...mergedConfig,
    duration: totalDurationSeconds,
    ...(collectedAudio ? { audio: collectedAudio } : {}),
  };

  const getSceneAtFrame = (frame: number): ResolvedComposeScene<TData> => {
    const clamped = Math.max(0, Math.min(Math.floor(frame), totalFrames - 1));
    const idx = frameToSceneIndex[clamped] ?? 0;
    return resolvedScenes[idx]!;
  };

  const result: MediaDefinition<TData, "video", RenderContext<TData>> = {
    kind: "media",
    media: "video",
    fallbackFormat: "mp4",
    medium,
    animated: true,
    config,

    render(ctx: RenderContext<TData>): RenderOutput {
      const frame = Math.min(ctx.globalFrame, totalFrames - 1);
      const scene = getSceneAtFrame(frame);
      const localFrame = frame - scene.startFrame;
      const sceneTimeline = createTimeline(localFrame, ctx.fps, scene.totalFrames);
      const parentSink = getIrSink(ctx);
      const directorCtx: DirectorContext = {
        timeline: sceneTimeline,
        fps: ctx.fps,
        ...(parentSink
          ? {
              instrument: {
                strictIds: parentSink.strictIds === true,
                sceneId: scene.id,
                frame,
                sceneStartFrame: scene.startFrame,
                totalFrames: scene.totalFrames,
                ...(parentSink.onDirector !== undefined ? { onDirector: parentSink.onDirector } : {}),
                ...(parentSink.onMotion !== undefined ? { onMotion: parentSink.onMotion } : {}),
                ...(parentSink.onIssue !== undefined ? { onIssue: parentSink.onIssue } : {}),
              },
            }
          : {}),
      };

      const sceneCtx: RenderContext<TData> = {
        ...ctx,
        sceneIndex: scene.index,
        sceneId: scene.id,
        timeline: sceneTimeline,
        director: (phases, opts) => createDirector(directorCtx, phases, opts),
        track: (source) =>
          createTrack(
            sceneTimeline,
            source,
            parentSink
              ? {
                  strictIds: parentSink.strictIds === true,
                  sceneId: scene.id,
                  frame,
                  sceneStartFrame: scene.startFrame,
                  totalFrames: scene.totalFrames,
                  ...(parentSink.onTrack !== undefined ? { onTrack: parentSink.onTrack } : {}),
                  ...(parentSink.onIssue !== undefined ? { onIssue: parentSink.onIssue } : {}),
                }
              : undefined,
          ),
        data: { ...scene.data, ...ctx.data } as TData,
        std: bindStdTiming(
          ctx.std,
          {
            fps: ctx.fps,
            frame: localFrame,
            totalFrames: scene.totalFrames,
            progress: sceneTimeline.progress,
            timeSeconds: sceneTimeline.seconds,
            durationSeconds: scene.duration,
          },
          ctx.std.scale ?? 1,
          parentSink
            ? {
                ...parentSink,
                strictIds: parentSink.strictIds === true,
                sceneId: scene.id,
                frame,
                sceneStartFrame: scene.startFrame,
                totalFrames: scene.totalFrames,
              }
            : undefined,
        ),
      };
      if (parentSink) {
        attachIrSink(sceneCtx, {
          ...parentSink,
          strictIds: parentSink.strictIds === true,
          sceneId: scene.id,
          frame,
          sceneStartFrame: scene.startFrame,
          totalFrames: scene.totalFrames,
        });
      }

      let markup: RenderOutput = scene.template.render(sceneCtx);

      const applyTransition = (
        t: ResolvedTransition,
        progress: number,
        phase: "enter" | "exit",
      ) => {
        const html = lowerRenderOutput(markup, medium, { width, height });
        if (medium === "svg") {
          return Vector(
            { width, height, viewBox: { x: 0, y: 0, width, height } },
            Html({
              width: "fill",
              height: "fill",
              html: renderSvgWithTransition(html, t, progress, phase, width, height),
            }),
          );
        }
        return Html({
          width: "fill",
          height: "fill",
          html: renderWithTransition(html, t, progress, phase),
        });
      };

      if (scene.enterTransition && scene.enterTransition.duration > 0) {
        const enterFrames = Math.round(scene.enterTransition.duration * fps);
        if (localFrame < enterFrames) {
          markup = applyTransition(scene.enterTransition, localFrame / enterFrames, "enter");
        }
      }

      if (scene.exitTransition && scene.exitTransition.duration > 0) {
        const exitFrames = Math.round(scene.exitTransition.duration * fps);
        const exitStartFrame = scene.totalFrames - exitFrames;
        if (localFrame >= exitStartFrame) {
          markup = applyTransition(
            scene.exitTransition,
            (localFrame - exitStartFrame) / exitFrames,
            "exit",
          );
        }
      }

      return markup;
    },
  };

  return result;
}

/**
 * Flatten `atScene` onto absolute `at` so the composed definition can be
 * planned without a separate scene-boundary table. `createRenderPlan` only
 * sees the merged audio list.
 */
function bakeComposeSceneAudio(
  audio: ReturnType<typeof collectComposeAudio>,
  scenes: readonly { id: string; startFrame: number }[],
  fps: number,
): ReturnType<typeof collectComposeAudio> {
  if (!audio) return undefined;
  return {
    ...audio,
    clips: audio.clips.map((clip) => {
      if (clip.at !== undefined || clip.atScene === undefined) return clip;
      const scene = scenes.find((candidate) => candidate.id === clip.atScene);
      if (!scene) {
        throw new Error(
          `Audio clip "${clip.id}" references unknown atScene "${clip.atScene}"`,
        );
      }
      const { atScene: _atScene, ...rest } = clip;
      return { ...rest, at: scene.startFrame / fps };
    }),
  };
}

function fontIdentity(font: FontInput): string {
  if (isGoogleFontDeclaration(font)) return `google\0${font.spec}`;
  const src = typeof font.src === "string"
    ? font.src
    : `bytes\0${font.src.byteLength}`;
  return `local\0${font.family}\0${font.weight ?? ""}\0${font.style ?? ""}\0${src}`;
}

function mergeConfigs<TData extends object>(scenes: TemplateModule<TData>[], override?: TemplateConfig): TemplateConfig {
  const fonts: FontInput[] = [];
  const seenFonts = new Set<string>();
  const addFont = (font: FontInput) => {
    const identity = fontIdentity(font);
    if (seenFonts.has(identity)) return;
    seenFonts.add(identity);
    fonts.push(font);
  };
  for (const font of override?.fonts ?? []) addFont(font);
  const stylesheets = new Set<string>(override?.stylesheets ?? []);
  const inlineCss = [...(override?.inlineCss ?? [])];
  const nativeModuleSets = [...(override?.nativeModuleSets ?? [])];

  let width = override?.width;
  let height = override?.height;
  let fps = override?.fps;

  let widthSource: number | undefined;
  let heightSource: number | undefined;
  let fpsSource: number | undefined;

  const warnings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const cfg = scenes[i]!.config;
    if (!cfg) continue;

    cfg.fonts?.forEach(addFont);
    cfg.stylesheets?.forEach((s) => stylesheets.add(s));
    cfg.inlineCss?.forEach((c) => inlineCss.push(c));
    nativeModuleSets.push(...(cfg.nativeModuleSets ?? []));

    if (cfg.width !== undefined) {
      if (width === undefined) {
        width = cfg.width;
        widthSource = i;
      } else if (cfg.width !== width) {
        warnings.push(
          `Width conflict: scene[${widthSource}] defines ${width}px, scene[${i}] defines ${cfg.width}px. Using ${width}px.`,
        );
      }
    }

    if (cfg.height !== undefined) {
      if (height === undefined) {
        height = cfg.height;
        heightSource = i;
      } else if (cfg.height !== height) {
        warnings.push(
          `Height conflict: scene[${heightSource}] defines ${height}px, scene[${i}] defines ${cfg.height}px. Using ${height}px.`,
        );
      }
    }

    if (cfg.fps !== undefined) {
      if (fps === undefined) {
        fps = cfg.fps;
        fpsSource = i;
      } else if (cfg.fps !== fps) {
        warnings.push(
          `FPS conflict: scene[${fpsSource}] defines ${fps}fps, scene[${i}] defines ${cfg.fps}fps. Using ${fps}fps.`,
        );
      }
    }
  }

  for (const w of warnings) {
    console.warn(`[compose] ${w}`);
  }

  return {
    ...override,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(fps !== undefined ? { fps } : {}),
    fonts,
    stylesheets: [...stylesheets],
    inlineCss,
    ...(nativeModuleSets.length > 0 ? { nativeModuleSets: uniqueNativeModuleSets(nativeModuleSets) } : {}),
  };
}
