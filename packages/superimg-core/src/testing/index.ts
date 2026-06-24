//! Testing helpers — thin wrappers over renderTemplateFrame / renderToHtml.

import type { AnyTemplateModule, ComposedTemplate } from "@superimg/types";
import {
  renderTemplateFrame,
  type RenderTemplateFrameOptions,
} from "../rendering/render-frame.js";

export type RenderHtmlAtFrameOptions = Omit<
  RenderTemplateFrameOptions,
  "template" | "composite"
> & {
  composite?: boolean;
};

/**
 * Render a single frame to composite HTML (no Playwright).
 * Merges `template.sample` with `data` and binds timing at the requested frame.
 */
export function renderHtmlAtFrame(
  template: AnyTemplateModule | ComposedTemplate,
  options: RenderHtmlAtFrameOptions = {},
): string {
  const { compositeHtml } = renderTemplateFrame({
    template,
    ...options,
    composite: options.composite !== false,
  });
  return compositeHtml;
}

export {
  renderTemplateFrame,
  resolveFrameIndex,
  type RenderTemplateFrameOptions,
  type RenderTemplateFrameResult,
} from "../rendering/render-frame.js";