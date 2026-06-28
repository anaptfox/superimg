//! Browser-side superimg bundler plugin (@rolldown/browser).
//! No node:* imports — stdlib subpaths are served from embedded virtual modules.

import { STDLIB_SOURCES } from "../generated/stdlib-sources.js";
import {
  buildSuperimgPlugin,
  type BundledStdlibSubpath,
} from "./plugin.shared.js";

const BUNDLED_STDLIB_VIRTUAL: Record<BundledStdlibSubpath, string> = {
  code: "\0stdlib-code",
  cue: "\0stdlib-cue",
  text: "\0stdlib-text",
};

const VIRTUAL_STDLIB_SOURCES: Record<string, string> = {
  "\0stdlib-code": STDLIB_SOURCES.code,
  "\0stdlib-cue": STDLIB_SOURCES.cue,
  "\0stdlib-text": STDLIB_SOURCES.text,
};

export function createSuperimgPlugin() {
  return buildSuperimgPlugin({
    resolveStdlibSubpath(sub) {
      if (sub in BUNDLED_STDLIB_VIRTUAL) {
        return BUNDLED_STDLIB_VIRTUAL[sub as BundledStdlibSubpath];
      }
      return "\0stdlib-noop";
    },
    loadStdlib(id) {
      return VIRTUAL_STDLIB_SOURCES[id] ?? null;
    },
  });
}