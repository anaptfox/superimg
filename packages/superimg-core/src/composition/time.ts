import {
  resolveSceneTree,
  collectSceneSnapshots,
  placeSceneSnapshot,
  multiplySceneMatrices,
} from "@superimg/stdlib/tree";
import type {
  AudioValue,
  CompositionFit,
  JsonObject,
  MediaDefinition,
  RenderContext,
  RenderOutput,
  Program,
  CompositionEntryData,
  InteractiveCompositionRuntime,
  SceneMatrix,
  SpatialSceneSnapshot,
} from "@superimg/types";
import { createDirector } from "@superimg/stdlib/director";
import { createTrack } from "@superimg/stdlib/track";
import { bindStdTiming } from "../shared/bind-std-timing.js";
import { createTimeline } from "../shared/create-timeline.js";
import { attachIrSink, getIrSink } from "../ir/sink-symbol.js";
import { Html } from "@superimg/stdlib/tree";
import { lowerRenderOutput } from "../rendering/lower-output.js";
import {
  compositionSchedule,
  planComposition,
  type CompositionProjectionOptions,
  type PlannedLeaf,
} from "./plan.js";
import { liftCompositionAudio } from "./audio.js";
import { scopedCompositionData, snapshotJsonObject } from "./scoped-data.js";
import { preparedChildResourcesFor } from "./resources.js";
import {
  compositionAssetNamespace,
  portableChildResourcesFor,
} from "./resources.js";
import { liftCompositionFonts } from "./fonts.js";
import { parseDuration } from "../shared/utils.js";
import { uniqueNativeModuleSets } from "./native-modules.js";
import { renderSvgWithTransition, renderWithTransition } from "./transitions.js";

export type TimeOptions = CompositionProjectionOptions & {
  /** Opt in to qualified occurrence metadata for browser inspection. */
  readonly inspection?: boolean;
  /** Optional composition-wide audio bed or clips (supports `atScene` targeting occurrence paths). */
  readonly audio?: AudioValue;
};

const interactiveRuntimes = new WeakMap<
  object,
  readonly { path: string; runtime: InteractiveCompositionRuntime }[]
>();
const interactiveRuntimesKey = Symbol.for(
  "superimg.interactive-composition-runtimes",
);
const inspectionKey = Symbol.for("superimg.composition-inspection");

// Live child renderers resolve their local scene before composition sees it.
// Qualify only portable occurrence identities; DOM actions still route through
// the child's local identities and the enclosing occurrence binding.
function occurrencePacket(
  packet: SpatialSceneSnapshot,
  leaf: PlannedLeaf,
): SpatialSceneSnapshot {
  if (!leaf.interactiveRuntime) return packet;
  const id = (value: string) => `${leaf.path}/${value}`;
  const camera = (value: SpatialSceneSnapshot["camera"]) => ({
    ...value,
    fit: value.fit ? { ...value.fit, target: id(value.fit.target) } : null,
    follow: value.follow
      ? { ...value.follow, target: id(value.follow.target) }
      : null,
  });
  return {
    ...packet,
    sceneId: id(packet.sceneId),
    rootIds: packet.rootIds.map(id),
    nodes: packet.nodes.map((node) => ({
      ...node,
      id: id(node.id),
      parentId: node.parentId === null ? null : id(node.parentId),
      childIds: node.childIds.map(id),
    })),
    camera: camera(packet.camera),
    states: Object.fromEntries(
      Object.entries(packet.states).map(([key, state]) => [
        key,
        {
          ...state,
          operations: state.operations.map((operation) => ({
            ...operation,
            target: id(operation.target),
          })),
          ...(state.camera
            ? {
                camera: {
                  ...state.camera,
                  ...(state.camera.fit
                    ? {
                        fit: {
                          ...state.camera.fit,
                          target: id(state.camera.fit.target),
                        },
                      }
                    : {}),
                  ...(state.camera.follow
                    ? {
                        follow: {
                          ...state.camera.follow,
                          target: id(state.camera.follow.target),
                        },
                      }
                    : {}),
                },
              }
            : {}),
        },
      ]),
    ),
    instances: packet.instances.map((instance) => ({
      ...instance,
      id: id(instance.id),
      attachment: instance.attachment
        ? { ...instance.attachment, instance: id(instance.attachment.instance) }
        : null,
    })),
    parts: packet.parts.map((part) => ({
      ...part,
      id: id(part.id),
      instanceId: id(part.instanceId),
    })),
  };
}

/** Internal host hook for bindings created by `time()`. */
export function interactiveCompositionRuntimes(
  media: object,
): readonly { path: string; runtime: InteractiveCompositionRuntime }[] {
  const render = (media as { render?: unknown }).render;
  const stamped =
    typeof render === "function"
      ? (
          render as unknown as Record<
            symbol,
            readonly { path: string; runtime: InteractiveCompositionRuntime }[]
          >
        )[interactiveRuntimesKey]
      : undefined;
  return interactiveRuntimes.get(media) ?? stamped ?? [];
}

function orientation(width: number, height: number) {
  const aspectRatio = width / height;
  return {
    aspectRatio,
    isPortrait: aspectRatio < 1,
    isLandscape: aspectRatio > 1,
    isSquare: aspectRatio === 1,
  };
}

function fitMarkup(
  markup: string,
  leaf: {
    width: number;
    height: number;
    fit?: CompositionFit;
    placement?: {
      rect: { x: number; y: number; width: number; height: number };
      fit: CompositionFit;
      groupSize?: { width: number; height: number };
    };
    placementChain?: readonly {
      rect: { x: number; y: number; width: number; height: number };
      fit: CompositionFit;
      groupSize?: { width: number; height: number };
    }[];
  },
  output: { width: number; height: number },
): string {
  let chain = leaf.placementChain ?? (leaf.placement ? [leaf.placement] : []);
  if (chain.length === 0) {
    if (!leaf.fit || leaf.fit === "reflow") return markup;
    chain = [
      {
        rect: { x: 0, y: 0, width: output.width, height: output.height },
        fit: leaf.fit,
      },
    ];
  }
  let childWidth = leaf.width;
  let childHeight = leaf.height;
  let result = markup;
  for (let i = chain.length - 1; i >= 0; i--) {
    const { rect, fit } = chain[i]!;
    if (fit === "reflow") {
      result = `<div style="position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;overflow:hidden">${result}</div>`;
      childWidth = rect.width;
      childHeight = rect.height;
      continue;
    }
    const scale =
      fit === "contain"
        ? Math.min(rect.width / childWidth, rect.height / childHeight)
        : Math.max(rect.width / childWidth, rect.height / childHeight);
    const left = (rect.width - childWidth * scale) / 2;
    const top = (rect.height - childHeight * scale) / 2;
    result = `<div style="position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;overflow:hidden"><div style="position:absolute;left:${left}px;top:${top}px;width:${childWidth}px;height:${childHeight}px;transform:scale(${scale});transform-origin:top left">${result}</div></div>`;
    // Each placement lives on the canvas of its own group. An explicit group
    // canvas remains stable when the group is reused in a different rect.
    childWidth =
      chain[i]!.groupSize?.width ??
      (i > 0 ? chain[i - 1]!.rect.width : output.width);
    childHeight =
      chain[i]!.groupSize?.height ??
      (i > 0 ? chain[i - 1]!.rect.height : output.height);
  }
  return result;
}

function liftPresentationCss(
  leaves: readonly PlannedLeaf[],
): Pick<
  NonNullable<MediaDefinition["config"]>,
  "inlineCss" | "stylesheets" | "tailwind"
> {
  // Child render output shares one browser document. CSS is therefore lifted
  // verbatim to the projection root; occurrence-specific selector rewriting is
  // intentionally outside this retained structural projection.
  const inlineCss: string[] = [];
  const stylesheets = new Set<string>();
  let tailwind: NonNullable<MediaDefinition["config"]>["tailwind"] | undefined;
  for (const leaf of leaves) {
    const config = leaf.content.config;
    inlineCss.push(...(config?.inlineCss ?? []));
    for (const stylesheet of config?.stylesheets ?? [])
      stylesheets.add(stylesheet);
    if (config?.tailwind !== undefined) {
      if (
        tailwind !== undefined &&
        JSON.stringify(tailwind) !== JSON.stringify(config.tailwind)
      ) {
        throw new TypeError(
          `composition: ${leaf.path}: child Tailwind config conflicts with another selected child`,
        );
      }
      tailwind = config.tailwind;
    }
  }
  return {
    ...(inlineCss.length > 0 ? { inlineCss } : {}),
    ...(stylesheets.size > 0 ? { stylesheets: [...stylesheets] } : {}),
    ...(tailwind !== undefined ? { tailwind } : {}),
  };
}

function childCanvas(
  leaf: {
    width: number;
    height: number;
    fit?: CompositionFit;
    placement?: { rect: { width: number; height: number } };
    placementChain?: readonly { rect: { width: number; height: number } }[];
  },
  output: { width: number; height: number },
): { width: number; height: number } {
  if (leaf.fit !== "reflow") return { width: leaf.width, height: leaf.height };
  const chain = leaf.placementChain ?? (leaf.placement ? [leaf.placement] : []);
  const target = chain.at(-1)?.rect ?? output;
  return { width: target.width, height: target.height };
}

/** Keep the authored Program canvas intact while fitting it into a delivery canvas. */
function fitDestination(
  markup: string,
  authored: { width: number; height: number },
  destination: { width: number; height: number },
): string {
  const scale = Math.min(
    destination.width / authored.width,
    destination.height / authored.height,
  );
  const left = (destination.width - authored.width * scale) / 2;
  const top = (destination.height - authored.height * scale) / 2;
  return `<div style="position:relative;width:${destination.width}px;height:${destination.height}px;overflow:hidden"><div style="position:absolute;left:${left}px;top:${top}px;width:${authored.width}px;height:${authored.height}px;transform:scale(${scale});transform-origin:top left">${markup}</div></div>`;
}

/**
 * Choose a deterministic video clock for a retained Program.
 * The returned definition retains both the authored Program and exact integer schedule.
 */
export function time<
  TEntry extends CompositionEntryData = CompositionEntryData,
>(
  program: Program,
  options: TimeOptions,
): MediaDefinition<TEntry, "video", RenderContext<TEntry>> {
  const plan = planComposition(program, options);
  const schedule = compositionSchedule(plan);
  const audio = liftCompositionAudio(plan, options.audio);
  const fonts = liftCompositionFonts(plan.leaves);
  const nativeModuleSets = uniqueNativeModuleSets(plan.leaves.flatMap(leaf => leaf.content.config?.nativeModuleSets ?? []));
  const presentationCss = liftPresentationCss(plan.leaves);
  const assets = Object.fromEntries(
    plan.leaves.flatMap((leaf) =>
      Object.entries(leaf.content.config?.assets ?? {}).map(
        ([name, declaration]) => [
          compositionAssetNamespace(leaf.path, name),
          declaration,
        ],
      ),
    ),
  );
  const onlyLeaf = plan.leaves.length === 1 ? plan.leaves[0] : undefined;
  // A positioned or heterogeneous leaf is composed in an HTML container. Raw
  // SVG remains a leaf inside that container, so mixed HTML/SVG stays retained.
  const medium =
    onlyLeaf !== undefined &&
    onlyLeaf.content.medium === "svg" &&
    onlyLeaf.fit === undefined &&
    onlyLeaf.placement === undefined
      ? "svg"
      : "html";

  const definition = Object.freeze({
    kind: "media",
    media: "video",
    fallbackFormat: "mp4",
    medium,
    animated: true,
    config: Object.freeze({
      width: options.size.width,
      height: options.size.height,
      fps: options.fps,
      duration: plan.totalFrames / options.fps,
      temporal: "once" as const,
      ...(Object.keys(assets).length > 0 ? { assets } : {}),
      ...(audio !== undefined ? { audio } : {}),
      ...(fonts.length > 0 ? { fonts } : {}),
      ...(nativeModuleSets.length > 0 ? { nativeModuleSets } : {}),
      ...presentationCss,
    }),
    composition: Object.freeze({
      schemaVersion: 0 as const,
      program,
      outputSize: Object.freeze({ ...options.size }),
      schedule,
    }),
    render(ctx: RenderContext<TEntry>): RenderOutput {
      const entryData = scopedCompositionData(
        ctx.data,
        plan.leaves.map((leaf) => leaf.path),
      );
      const globalFrame = Math.max(
        0,
        Math.min(Math.floor(ctx.globalFrame), plan.totalFrames - 1),
      );
      const activeLeaves = plan.leaves.filter(
        (leaf) => globalFrame >= leaf.startFrame && globalFrame < leaf.endFrame,
      );
      const rendered = activeLeaves.map((leaf) => {
        const outputFrame = Math.min(
          globalFrame - leaf.startFrame,
          (leaf.contentEndFrame ?? leaf.endFrame) - leaf.startFrame - 1,
        );
        const childFps = leaf.fps ?? options.fps;
        const duration = leaf.content.config?.duration;
        const sourceFrames =
          leaf.sourceTotalFrames ??
          (leaf.fps && duration !== undefined
            ? Math.max(
                1,
                Math.round(
                  parseDuration(duration, `${leaf.path}.duration`, childFps) *
                    childFps,
                ),
              )
            : leaf.totalFrames);
        const localFrame = Math.min(
          (leaf.trimInFrames ?? 0) + Math.floor((outputFrame * childFps) / options.fps),
          sourceFrames - 1,
        );
        const timeline = createTimeline(localFrame, childFps, sourceFrames);
        const canvas = childCanvas(leaf, options.size);
        const childOrientation = orientation(canvas.width, canvas.height);
        const outerSink = getIrSink(ctx);
        const localSink = outerSink
          ? {
              ...outerSink,
              sceneId: leaf.path,
              frame: globalFrame,
              sceneStartFrame: leaf.startFrame,
              totalFrames: leaf.totalFrames,
            }
          : undefined;
        const preparedResources = preparedChildResourcesFor(leaf.content);
        const resources =
          preparedResources ??
          portableChildResourcesFor(leaf.content, leaf.path);
        const asset = (name: string): string => {
          if (
            leaf.content.config?.assets &&
            Object.hasOwn(leaf.content.config.assets, name)
          ) {
            // The runtime freezes root declarations to owned data URLs before
            // rendering. Prefer that binding, including for a prepared child;
            // otherwise a local file URL could bypass the frozen bytes in a
            // browser frame. A bare render still falls back to the prepared
            // provider URL or the portable authored declaration.
            const rootKey = compositionAssetNamespace(leaf.path, name);
            const rootUrl = ctx.asset(rootKey);
            return rootUrl === rootKey ? resources.urls[name]! : rootUrl;
          }
          throw new TypeError(
            `composition: ${leaf.path}: asset "${name}" is not declared in child config.assets`,
          );
        };
        const localContext: RenderContext<JsonObject> = {
          ...ctx,
          globalFrame,
          globalTimeSeconds: globalFrame / options.fps,
          totalFrames: plan.totalFrames,
          totalDurationSeconds: plan.totalFrames / options.fps,
          sceneIndex: plan.leaves.indexOf(leaf),
          sceneId: leaf.path,
          fps: childFps,
          width: canvas.width,
          height: canvas.height,
          ...childOrientation,
          cssViewport: {
            width: canvas.width,
            height: canvas.height,
            devicePixelRatio: 1,
          },
          timeline,
          director: (phases, directorOptions) =>
            createDirector(
              {
                timeline,
                fps: childFps,
                ...(localSink ? { instrument: localSink } : {}),
              },
              phases,
              directorOptions,
            ),
          track: (source) => createTrack(timeline, source, localSink),
          std: bindStdTiming(
            ctx.std,
            {
              fps: childFps,
              frame: localFrame,
              totalFrames: sourceFrames,
              progress: timeline.progress,
              timeSeconds: timeline.seconds,
              durationSeconds: timeline.durationSeconds,
            },
            ctx.std.scale ?? 1,
            localSink,
          ),
          data: snapshotJsonObject(
            {
              ...(leaf.content.sample &&
              typeof leaf.content.sample === "object" &&
              !Array.isArray(leaf.content.sample)
                ? leaf.content.sample
                : {}),
              ...(leaf.data ?? {}),
              ...(entryData[leaf.path] ?? {}),
            },
            `${leaf.path}.data`,
          ) as JsonObject,
          assets: resources?.assets ?? {},
          asset,
        };
        if (localSink) attachIrSink(localContext, localSink);
        return {
          leaf,
          output: resolveSceneTree(leaf.content.render(localContext as never), {
            prefix: leaf.path,
          }),
        };
      });
      const destination = { width: ctx.width, height: ctx.height };
      const atAuthoredSize =
        destination.width === options.size.width &&
        destination.height === options.size.height;
      const hasActiveTransition = rendered.some(({ leaf }) => {
        const localOutputFrame = globalFrame - leaf.startFrame;
        if (leaf.enter && localOutputFrame < leaf.enter.durationFrames) return true;
        if (leaf.exit && globalFrame >= leaf.endFrame - leaf.exit.durationFrames) return true;
        return false;
      });
      if (
        atAuthoredSize &&
        !hasActiveTransition &&
        rendered.length === 1 &&
        (!rendered[0]!.leaf.fit ||
          (rendered[0]!.leaf.fit === "reflow" && !rendered[0]!.leaf.placement))
      ) {
        const { leaf, output } = rendered[0]!;
        if (!options.inspection) return output;
        return {
          ...Html({
            width: "fill",
            height: "fill",
            html: occurrenceMarkup(
              lowerRenderOutput(
                output,
                leaf.content.medium,
                childCanvas(leaf, options.size),
              ),
              leaf.content.medium,
              leaf.path,
            ),
          }),
          sceneSnapshots: collectSceneSnapshots(output).map((packet) =>
            occurrencePacket(packet, leaf),
          ),
        };
      }
      const applyLeafTransition = (
        content: string,
        leaf: PlannedLeaf,
        canvas: { width: number; height: number },
      ): string => {
        const localOutputFrame = globalFrame - leaf.startFrame;
        let result = content;
        if (leaf.enter && leaf.enter.durationFrames > 0 && localOutputFrame < leaf.enter.durationFrames) {
          const progress = localOutputFrame / leaf.enter.durationFrames;
          result = leaf.content.medium === "svg"
            ? renderSvgWithTransition(result, leaf.enter, progress, "enter", canvas.width, canvas.height)
            : renderWithTransition(result, leaf.enter, progress, "enter");
        }
        const exitStart = leaf.endFrame - (leaf.exit?.durationFrames ?? 0);
        if (leaf.exit && leaf.exit.durationFrames > 0 && globalFrame >= exitStart) {
          const progress = (globalFrame - exitStart) / leaf.exit.durationFrames;
          result = leaf.content.medium === "svg"
            ? renderSvgWithTransition(result, leaf.exit, progress, "exit", canvas.width, canvas.height)
            : renderWithTransition(result, leaf.exit, progress, "exit");
        }
        return result;
      };
      const markup = rendered
        .map(({ leaf, output }) => {
          const canvas = childCanvas(leaf, options.size);
          const lowered = applyLeafTransition(
            lowerRenderOutput(
              output,
              leaf.content.medium,
              canvas,
            ),
            leaf,
            canvas,
          );
          return fitMarkup(
            options.inspection
              ? occurrenceMarkup(lowered, leaf.content.medium, leaf.path)
              : lowered,
            leaf,
            options.size,
          );
        })
        .join("");
      const groupSize = program.op === "together" ? program.size : undefined;
      const contentSize = groupSize ?? options.size;
      const groupMarkup = `<div style="position:relative;width:${contentSize.width}px;height:${contentSize.height}px;overflow:hidden">${markup}</div>`;
      const authoredMarkup =
        groupSize &&
        (groupSize.width !== options.size.width ||
          groupSize.height !== options.size.height)
          ? fitDestination(groupMarkup, groupSize, options.size)
          : groupMarkup;
      if (!atAuthoredSize && medium !== "html") {
        throw new TypeError(
          "composition: destination sizing for SVG children requires an authored edition",
        );
      }
      const result = Html({
        width: "fill",
        height: "fill",
        html: atAuthoredSize
          ? authoredMarkup
          : fitDestination(authoredMarkup, options.size, destination),
      });
      return {
        ...result,
        sceneSnapshots: rendered.flatMap(({ leaf, output }) =>
          collectSceneSnapshots(output).map((packet) =>
            placeSceneSnapshot(
              occurrencePacket(packet, leaf),
              packetPlacement(leaf, options.size, contentSize, destination),
              { x: 0, y: 0, ...destination },
            ),
          ),
        ),
      };
    },
  });
  const runtimes = plan.leaves.flatMap((leaf) =>
    leaf.interactiveRuntime
      ? [{ path: leaf.path, runtime: leaf.interactiveRuntime }]
      : [],
  );
  if (runtimes.length) {
    const frozen = Object.freeze(runtimes);
    interactiveRuntimes.set(definition, frozen);
    // Render identity survives resolve() spread clones and separate browser/Node
    // build graphs, while the WeakMap remains the fast local lookup.
    Object.defineProperty(definition.render, interactiveRuntimesKey, {
      value: frozen,
    });
  }
  if (options.inspection)
    Object.defineProperty(definition.render, inspectionKey, { value: true });
  return definition;
}

function occurrenceMarkup(
  markup: string,
  medium: "html" | "svg",
  path: string,
): string {
  const escaped = path.replace(
    /[&"<>]/g,
    (character) =>
      ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character]!,
  );
  if (medium === "svg")
    return markup.replace(
      /<svg(?=[\s>])/i,
      `<svg data-si-occurrence="${escaped}"`,
    );
  return `<div data-si-occurrence="${escaped}" style="display:contents">${markup}</div>`;
}

/** Same placement algebra as fitMarkup/fitDestination, applied to inspection geometry. */
function packetPlacement(
  leaf: PlannedLeaf,
  authored: { width: number; height: number },
  group: { width: number; height: number },
  destination: { width: number; height: number },
): SceneMatrix {
  const identity: SceneMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const contain = (
    from: { width: number; height: number },
    into: { width: number; height: number },
  ): SceneMatrix => {
    const scale = Math.min(into.width / from.width, into.height / from.height);
    return {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: (into.width - from.width * scale) / 2,
      f: (into.height - from.height * scale) / 2,
    };
  };
  let chain = leaf.placementChain ?? (leaf.placement ? [leaf.placement] : []);
  if (!chain.length && leaf.fit && leaf.fit !== "reflow")
    chain = [
      {
        groupPath: "",
        end: "hold",
        rect: { x: 0, y: 0, ...authored },
        fit: leaf.fit,
      },
    ];
  let size = childCanvas(leaf, authored),
    matrix = identity;
  for (let i = chain.length - 1; i >= 0; i--) {
    const step = chain[i]!,
      { rect, fit } = step;
    const scale =
      fit === "reflow"
        ? 1
        : fit === "contain"
          ? Math.min(rect.width / size.width, rect.height / size.height)
          : Math.max(rect.width / size.width, rect.height / size.height);
    matrix = multiplySceneMatrices(
      {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e:
          rect.x +
          (fit === "reflow" ? 0 : (rect.width - size.width * scale) / 2),
        f:
          rect.y +
          (fit === "reflow" ? 0 : (rect.height - size.height * scale) / 2),
      },
      matrix,
    );
    size = step.groupSize ?? (i > 0 ? chain[i - 1]!.rect : authored);
  }
  if (group.width !== authored.width || group.height !== authored.height)
    matrix = multiplySceneMatrices(contain(group, authored), matrix);
  return multiplySceneMatrices(contain(authored, destination), matrix);
}
