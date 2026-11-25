//! Hyperscript constructor for the authoring tree.

import {
  MEDIA_ELEMENT,
  type MediaChild,
  type MediaElement,
  type MediaProps,
} from "./node-types.js";
export { MEDIA_ELEMENT };

export function isMediaElement(value: unknown): value is MediaElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as MediaElement).$$typeof === MEDIA_ELEMENT &&
    typeof (value as MediaElement).type === "string"
  );
}

function flattenChildren(children: readonly MediaChild[]): MediaChild[] {
  const out: MediaChild[] = [];
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) {
      continue;
    }
    if (Array.isArray(child)) {
      out.push(...flattenChildren(child));
      continue;
    }
    out.push(child);
  }
  return out;
}

/**
 * Hyperscript constructor. `type` is an HTML/SVG tag or a primitive name
 * (`Frame`, `Stack`, `Text`, …).
 */
export function h<
  const TType extends string,
  const TProps extends object = MediaProps,
>(
  type: TType,
  props?: (TProps & MediaProps) | null,
  ...children: MediaChild[]
): MediaElement<TType, TProps & MediaProps> {
  const raw = (props ?? {}) as TProps & MediaProps;
  const { key, ...rest } = raw;
  const fromProps = (rest as Record<string, unknown>).children;
  const nested = Array.isArray(fromProps)
    ? (fromProps as MediaChild[])
    : fromProps !== undefined
      ? [fromProps as MediaChild]
      : [];
  const { children: _ignored, ...attrProps } = rest as Record<string, unknown>;
  return {
    $$typeof: "@foxworth/superimg/element",
    type,
    props: attrProps as TProps & MediaProps & Record<string, unknown>,
    children: flattenChildren([...nested, ...children]),
    ...(key !== undefined && key !== null ? { key: String(key) } : {}),
  };
}
