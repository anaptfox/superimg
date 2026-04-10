//! Scene composition - combine multiple templates into a single video

import type {
  TemplateModule,
  RenderContext,
  TemplateConfig,
  SceneDefinition,
  ResolvedScene,
  ResolvedTransition,
  ComposedTemplate,
  Duration,
} from "@superimg/types";
import type { Checkpoint } from "@superimg/types";
import { parseDuration } from "../shared/utils.js";
import { renderWithTransition } from "./transitions.js";

function isSceneDefinition(
  item: TemplateModule | SceneDefinition
): item is SceneDefinition {
  return "template" in item && typeof (item as SceneDefinition).template === "object";
}

function normalizeToSceneDefinitions(
  items: (TemplateModule | SceneDefinition)[]
): SceneDefinition[] {
  return items.map((item) =>
    isSceneDefinition(item)
      ? item
      : { template: item as TemplateModule }
  );
}

function resolveTransition(
  t: { type: string; duration: Duration; easing?: string } | undefined,
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
    easing: t.easing,
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
  scenes: (TemplateModule | SceneDefinition)[],
): ComposedTemplate {
  if (scenes.length === 0) {
    throw new Error("compose() requires at least one scene");
  }

  const definitions = normalizeToSceneDefinitions(scenes);
  const mergedConfig = mergeConfigs(definitions.map((d) => d.template));
  const fps = mergedConfig.fps ?? 30;

  const resolvedScenes: ResolvedScene[] = [];
  let currentFrame = 0;

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
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
      label: def.label,
      index: i,
      template,
      startFrame: currentFrame,
      endFrame: currentFrame + totalFrames,
      totalFrames,
      duration: durationSeconds,
      data: { ...template.data, ...def.data } as Record<string, unknown>,
      enterTransition,
      exitTransition,
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

  const config: TemplateConfig = {
    ...mergedConfig,
    duration: totalDurationSeconds,
  };

  const result: ComposedTemplate = {
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
      const idx = frameToSceneIndex[clamped];
      return resolvedScenes[idx]!;
    },

    render(ctx: RenderContext): string {
      const frame = Math.min(ctx.globalFrame, totalFrames - 1);
      const scene = result.getSceneAtFrame(frame);
      const sceneFrame = frame - scene.startFrame;
      const sceneProgress =
        scene.totalFrames > 1
          ? Math.min(sceneFrame / (scene.totalFrames - 1), 1)
          : 1;
      const sceneTimeSeconds = sceneFrame / ctx.fps;

      const sceneCtx: RenderContext = {
        ...ctx,
        sceneIndex: scene.index,
        sceneId: scene.id,
        sceneFrame,
        sceneTimeSeconds,
        sceneProgress,
        sceneTotalFrames: scene.totalFrames,
        sceneDurationSeconds: scene.duration,
        // scene.data already has: defaults + def.data
        // Only merge runtime ctx.data on top
        data: { ...scene.data, ...ctx.data } as RenderContext["data"],
      };

      let html = scene.template.render(sceneCtx);

      // Apply enter transition at scene start
      if (scene.enterTransition && scene.enterTransition.duration > 0) {
        const enterFrames = Math.round(
          scene.enterTransition.duration * fps
        );
        if (sceneFrame < enterFrames) {
          const progress = sceneFrame / enterFrames;
          html = renderWithTransition(html, scene.enterTransition, progress);
        }
      }

      // Apply exit transition at scene end
      if (scene.exitTransition && scene.exitTransition.duration > 0) {
        const exitFrames = Math.round(
          scene.exitTransition.duration * fps
        );
        const exitStartFrame = scene.totalFrames - exitFrames;
        if (sceneFrame >= exitStartFrame) {
          const progress = (sceneFrame - exitStartFrame) / exitFrames;
          html = renderWithTransition(
            html,
            scene.exitTransition,
            progress,
            "exit"
          );
        }
      }

      return html;
    },

    getCheckpoints(): Checkpoint[] {
      return resolvedScenes.map((s) => ({
        id: s.id,
        frame: s.startFrame,
        time: s.startFrame / fps,
        label: s.label,
        metadata: { sceneIndex: s.index },
        source: { type: "scene" as const, sceneId: s.id },
      }));
    },
  };

  return result;
}

function mergeConfigs(scenes: TemplateModule[]): TemplateConfig {
  const fonts = new Set<string>();
  const stylesheets = new Set<string>();
  const inlineCss: string[] = [];

  let width: number | undefined;
  let height: number | undefined;
  let fps: number | undefined;

  let widthSource: number | undefined;
  let heightSource: number | undefined;
  let fpsSource: number | undefined;

  const warnings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const cfg = scenes[i].config;
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
          `Width conflict: scene[${widthSource}] defines ${width}px, scene[${i}] defines ${cfg.width}px. Using ${width}px.`
        );
      }
    }

    if (cfg.height !== undefined) {
      if (height === undefined) {
        height = cfg.height;
        heightSource = i;
      } else if (cfg.height !== height) {
        warnings.push(
          `Height conflict: scene[${heightSource}] defines ${height}px, scene[${i}] defines ${cfg.height}px. Using ${height}px.`
        );
      }
    }

    if (cfg.fps !== undefined) {
      if (fps === undefined) {
        fps = cfg.fps;
        fpsSource = i;
      } else if (cfg.fps !== fps) {
        warnings.push(
          `FPS conflict: scene[${fpsSource}] defines ${fps}fps, scene[${i}] defines ${cfg.fps}fps. Using ${fps}fps.`
        );
      }
    }
  }

  for (const w of warnings) {
    console.warn(`[compose] ${w}`);
  }

  return {
    width,
    height,
    fps,
    fonts: [...fonts],
    stylesheets: [...stylesheets],
    inlineCss,
  };
}
