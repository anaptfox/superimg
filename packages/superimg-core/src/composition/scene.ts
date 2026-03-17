//! Scene helper for compose() - wraps a template with scene options

import type {
  Duration,
  TemplateModule,
  SceneDefinition,
  Transition,
} from "@superimg/types";

export interface SceneOptions<TData = Record<string, unknown>> {
  duration?: Duration;
  id?: string;
  label?: string;
  data?: Partial<TData>;
  enter?: Transition;
  exit?: Transition;
}

/**
 * Wrap a template with scene options for use in compose().
 *
 * @example
 * ```typescript
 * compose([
 *   scene(intro, { id: "intro", duration: "3s", exit: { type: "fade", duration: "500ms" } }),
 *   scene(content, { id: "main", duration: "10s", data: { highlightColor: "#ff0000" } }),
 * ]);
 * ```
 */
export function scene<TData extends Record<string, unknown>>(
  template: TemplateModule<TData>,
  options?: SceneOptions<TData>
): SceneDefinition<TData> {
  return { template, ...options };
}
