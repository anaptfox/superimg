//! The browser-free still lane (tree → SVG, font metrics) is installed by the
//! node, edge, and CLI entry points. The Player graph never installs it, so
//! playback bundles stay free of the SVG lowering and font parser.

import type { BrowserReason, LowerSvgOptions, NeedsBrowserConfig } from "@superimg/stdlib/tree";
import type { MediaElement } from "@superimg/types";
import type { TextMeasurer } from "@superimg/stdlib/svg";
import type { MetricFontSource } from "./text-measurer.js";

export interface StillLaneKit {
  lowerSvg(tree: MediaElement, options: LowerSvgOptions): string;
  needsBrowser(tree: MediaElement, config?: NeedsBrowserConfig): { browser: boolean; reasons: BrowserReason[] };
  textMeasurerFromFaces(faces: readonly MetricFontSource[]): TextMeasurer | undefined;
}

let installed: StillLaneKit | undefined;

export function installStillLaneKit(kit: StillLaneKit): void {
  installed = kit;
}

export function stillLaneKit(): StillLaneKit | undefined {
  return installed;
}
