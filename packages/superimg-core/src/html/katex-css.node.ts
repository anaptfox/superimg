//! KaTeX CSS — sourced from the stdlib bundle (no Node runtime reads).
//! The CSS is inlined at stdlib build time via the css-as-text esbuild plugin.

import { katexCss } from "@superimg/stdlib/viz";

export const katexStyle: string = katexCss ? `<style>${katexCss}</style>` : "";
