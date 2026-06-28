//! Scene composition - combine multiple templates into a single video

import type {
  AnimatedTemplateModule,
  TemplateModule,
  RenderContext,
  TemplateConfig,
  SceneDefinition,
  ResolvedScene,
  ResolvedTransition,
  ComposedTemplate,
  Duration,
  EasingName,
} from "@superimg/types";
import type { Checkpoint } from "@superimg/types";
import { parseDuration } from "../shared/utils.js";
import { collectComposeAudio } from "../shared/assets.js";
import { bindStdTiming } from "../shared/bind-std-timing.js";
import { createTimeline } from "../shared/create-timeline.js";
import { stdlib } from "../shared/stdlib.js";
import { createDirector } from "@superimg/stdlib/director";
import { createTrack } from "@superimg/stdlib/track";
import { renderWithTransition, renderSvgWithTransition } from "./transitions.js";
import type { Medium } from "@superimg/types";

function isSceneDefinition(
  item: AnimatedTemplateModule | SceneDefinition
): item is SceneDefinition {
  return "template" in item && typeof (item as SceneDefinition).template === "object";
}

function normalizeToSceneDefinitions(
  items: (AnimatedTemplateModule | SceneDefinition)[]
): SceneDefinition[] {
  return items.map((item) =>
    isSceneDefinition(item)
      ? item
      : { template: item as TemplateModule }
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
 * Compose multiple scene templates into a single video.
 * Accepts raw TemplateModules or SceneDefinitions (from scene()).
 *
 * @param scenes - Array of template modules or scene definitions
 * @returns ComposedTemplate with scene access and navigation
 */
export function compose(
  scenes: (AnimatedTemplateModule | SceneDefinition)[],
  options?: { config?: TemplateConfig },
): ComposedTemplate {
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

  const resolvedScenes: ResolvedScene[] = [];
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
      data: { ...template.sample, ...def.data } as Record<string, unknown>,
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

  const collectedAudio = collectComposeAudio(definitions, mergedConfig.audio);

  const config: TemplateConfig = {
    ...mergedConfig,
    duration: totalDurationSeconds,
    ...(collectedAudio ? { audio: collectedAudio } : {}),
  };

  const result: ComposedTemplate = {
    medium,
    animated: true,
    type: "composed",
    scenes: resolvedScenes,
    totalFrames,
    duration: totalDurationSeconds,
    fps,
    config,

    getScene(index: number): ResolvedScene | undefined {
      return resolvedScenes[index];
    },

    getSceneById(id: string): ResolvedScene | undefined {
      return resolvedScenes.find((s) => s.id === id);
    },

    getSceneAtFrame(frame: number): ResolvedScene {
      const clamped = Math.max(0, Math.min(Math.floor(frame), totalFrames - 1));
      const idx = frameToSceneIndex[clamped] ?? 0;
      return resolvedScenes[idx]!;
    },

    render(ctx: RenderContext): string {
      const frame = Math.min(ctx.globalFrame, totalFrames - 1);
      const scene = result.getSceneAtFrame(frame);
      const localFrame = frame - scene.startFrame;
      const sceneTimeline = createTimeline(localFrame, ctx.fps, scene.totalFrames);
      const directorCtx = { timeline: sceneTimeline, fps: ctx.fps };

      const sceneCtx: RenderContext = {
        ...ctx,
        sceneIndex: scene.index,
        sceneId: scene.id,
        timeline: sceneTimeline,
        director: (phases) => createDirector(directorCtx, phases),
        track: (source) => createTrack(sceneTimeline, source),
        data: { ...scene.data, ...ctx.data } as RenderContext["data"],
        std: bindStdTiming(
          stdlib,
          {
            fps: ctx.fps,
            frame: localFrame,
            totalFrames: scene.totalFrames,
            progress: sceneTimeline.progress,
            timeSeconds: sceneTimeline.seconds,
            durationSeconds: scene.duration,
          },
          ctx.std.scale ?? 1,
        ),
      };

      let markup = scene.template.render(sceneCtx);

      const applyTransition = (
        t: ResolvedTransition,
        progress: number,
        phase: "enter" | "exit",
      ) => {
        if (medium === "svg") {
          return renderSvgWithTransition(markup, t, progress, phase, width, height);
        }
        return renderWithTransition(markup, t, progress, phase);
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

    getCheckpoints(): Checkpoint[] {
      return resolvedScenes.map((s) => ({
        id: s.id,
        frame: s.startFrame,
        time: s.startFrame / fps,
        ...(s.label !== undefined ? { label: s.label } : {}),
        metasample: { sceneIndex: s.index },
        source: { type: "scene" as const, sceneId: s.id },
      }));
    },
  };

  return result;
}

function mergeConfigs(scenes: TemplateModule[], override?: TemplateConfig): TemplateConfig {
  const fonts = new Set<string>(override?.fonts ?? []);
  const stylesheets = new Set<string>(override?.stylesheets ?? []);
  const inlineCss = [...(override?.inlineCss ?? [])];

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

    cfg.fonts?.forEach((f) => fonts.add(f));
    cfg.stylesheets?.forEach((s) => stylesheets.add(s));
    cfg.inlineCss?.forEach((c) => inlineCss.push(c));

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
    fonts: [...fonts],
    stylesheets: [...stylesheets],
    inlineCss,
  };
}
