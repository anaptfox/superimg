//! Pure frame evaluation for MediaSession. It owns no clock, DOM, or events.

import {
  renderTemplateFrame,
  resolveRuntimeTemplateInfo,
  type PreparedStdlib,
  type RuntimeTemplate,
  type RuntimeTemplateInfo,
} from "@superimg/core/player-core";
import { isMediaElement, type AssetMeta, type MediaChild, type MediaElement } from "@superimg/types";
import type {
  PreResolvedFonts,
  RuntimeInput,
  RuntimeUpdate,
  RuntimeAcceptedPresentation,
} from "./runtime-contract.js";
import { escapedTreeHtml } from "./escaped-html.js";
import type { FramePerformanceSample } from "./performance.js";

export interface FrameEvaluatorOptions {
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  fonts?: PreResolvedFonts;
  /** Internal host hook; called synchronously after evaluating the frame. */
  captureSemantic?: () => Readonly<Record<string, unknown>> | undefined;
}

export interface EvaluatedFrame {
  frame: number;
  html: string;
  compositeHtml: string;
  tree: MediaElement;
  containsHtml: boolean;
  /** Internal exact-byte proof; only escaped pure trees receive one. */
  escapedTree?: object;
  semantic?: RuntimeAcceptedPresentation["semantic"];
  /** Private evaluation binding; never copied into presentation/IR payloads. */
  acceptEvaluation?: () => void;
}

export class FrameEvaluator {
  readonly info: RuntimeTemplateInfo;
  private readonly data: Record<string, unknown>;
  private readonly assets: Record<string, AssetMeta>;
  private readonly assetResolver: ((filename: string) => string) | undefined;

  constructor(
    readonly template: RuntimeInput,
    readonly options: FrameEvaluatorOptions = {},
    private readonly preparedStdlib?: PreparedStdlib,
  ) {
    this.data = options.data ?? {};
    this.assets = options.assets ?? {};
    this.assetResolver = options.assetResolver;
    this.info = resolveRuntimeTemplateInfo(template as RuntimeTemplate, {
      data: this.data,
      ...(options.width !== undefined ? { width: options.width } : {}),
      ...(options.height !== undefined ? { height: options.height } : {}),
      ...(options.fps !== undefined ? { fps: options.fps } : {}),
      ...(options.duration !== undefined ? { duration: options.duration } : {}),
    });
  }

  withUpdate(update: RuntimeUpdate): FrameEvaluator {
    return new FrameEvaluator(this.template, {
      ...this.options,
      ...update,
      ...(update.data
        ? { data: { ...(this.options.data ?? {}), ...update.data } }
        : this.options.data !== undefined
          ? { data: this.options.data }
          : {}),
    }, this.preparedStdlib);
  }

  render(frame: number, performanceSample?: FramePerformanceSample): EvaluatedFrame {
    let escaped = false;
    const result = renderTemplateFrame({
      template: this.template,
      frame,
      fps: this.info.fps,
      durationSeconds: this.info.duration,
      width: this.info.width,
      height: this.info.height,
      data: this.info.data,
      assets: this.assets,
      ...(this.assetResolver !== undefined ? { assetResolver: this.assetResolver } : {}),
      ...(this.preparedStdlib !== undefined ? { preparedStdlib: this.preparedStdlib } : {}),
      ...(performanceSample ? { onTiming: (stage: "context" | "render" | "lower" | "composite", ms: number) => performanceSample.timing(stage, ms) } : {}),
      onSerializationComplete: (safe: boolean) => { escaped = safe; },
    });
    if (!result.tree) {
      throw new TypeError("MediaSession frame evaluation did not return a media tree");
    }
    const semanticStart = performanceSample?.start();
    const direct = this.template as RuntimeInput & {
      getInteractiveSnapshot?: () => unknown;
      /** Internal adapter hook, captured before any asynchronous presentation. */
      captureFrameAcceptance?: () => (() => void);
    };
    const acceptEvaluation = direct.captureFrameAcceptance?.();
    const semantic = this.options.captureSemantic?.() ?? (typeof direct.getInteractiveSnapshot === "function"
      ? { root: direct.getInteractiveSnapshot() }
      : undefined);
    const snapshot = semantic !== undefined ? snapshotSemantic(semantic) : undefined;
    if (semanticStart !== undefined) performanceSample?.end("semantic", semanticStart);
    const containsHtml = containsHtmlNode(result.tree);
    return {
      frame: result.frame,
      ...(acceptEvaluation ? { acceptEvaluation } : {}),
      html: result.html,
      compositeHtml: result.compositeHtml,
      tree: result.tree,
      containsHtml,
      ...(escaped && result.compositeHtml === `<div style="position:absolute;inset:0;overflow:hidden">${result.html}</div>`
        ? { escapedTree: escapedTreeHtml(result.compositeHtml) } : {}),
      ...(snapshot !== undefined ? { semantic: snapshot } : {}),
    };
  }
}

/** Copy nested values so later controller evaluation cannot rewrite an accepted snapshot. */
function snapshotSemantic(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}

export function containsHtmlNode(root: MediaElement): boolean {
  if (root.type === "Html") return true;
  return root.children.some(containsHtmlChild);
}

function containsHtmlChild(child: MediaChild): boolean {
  if (Array.isArray(child)) return child.some(containsHtmlChild);
  return isMediaElement(child) ? containsHtmlNode(child) : false;
}
