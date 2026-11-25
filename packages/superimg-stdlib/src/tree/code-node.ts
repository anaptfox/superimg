//! Code primitive — lives outside primitives.ts so the browser player graph
//! can import Html/Image/Video without pulling the lazy `code` capability.

import type { MediaElement } from "./node-types.js";
import { h } from "./h.js";
import type { BoxProps } from "./primitives.js";
import { highlight, type HighlightOptions, type LangName, type ThemeName } from "../code.js";

export interface CodeProps extends BoxProps {
  /** Character reveal progress (0..1) for typewriter / progressive reveal. */
  reveal?: number;
  code?: string;
  lang?: LangName;
  theme?: ThemeName;
  lineNumbers?: boolean;
}

export function Code(
  props: CodeProps = {},
): MediaElement<"Code", CodeProps & { html: string; code: string; lang: LangName; theme: ThemeName }> {
  const source = props.code ?? "";
  const lang = props.lang ?? "ts";
  const theme = props.theme ?? "dark-plus";
  const opts: HighlightOptions = {
    lang,
    theme,
    ...(props.lineNumbers !== undefined ? { lineNumbers: props.lineNumbers } : {}),
  };
  const { code: _c, lang: _l, theme: _t, lineNumbers: _n, ...rest } = props;
  return h("Code", {
    ...rest,
    code: source,
    lang,
    theme,
    ...(props.lineNumbers !== undefined ? { lineNumbers: props.lineNumbers } : {}),
    html: highlight(source, opts),
    pad: rest.pad ?? 16,
  });
}
