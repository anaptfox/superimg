//! Browser-side superimg bundler plugin (@rolldown/browser).
//! No node:* imports — virtual modules are filled from a build-time map
//! (see scripts/build-browser-virtuals.mjs → .generated/browser-virtuals.ts).

import { BROWSER_VIRTUAL_MODULES } from "../../.generated/browser-virtuals.js";
import {
  buildSuperimgPlugin,
  type BundledStdlibSubpath,
} from "./plugin.shared.js";

const SUPERIMG_VIRTUAL = "\0superimg-virtual";
const SUPERIMG_DEFINE = "\0superimg-define";

const BUNDLED_STDLIB_VIRTUAL: Record<BundledStdlibSubpath, string> = {
  code: "\0stdlib-code",
  cue: "\0stdlib-cue",
  text: "\0stdlib-text",
};

export function createSuperimgPlugin() {
  return buildSuperimgPlugin({
    resolveSuperimg: () => SUPERIMG_VIRTUAL,
    resolveDefine: () => SUPERIMG_DEFINE,
    resolveStdlibSubpath(sub) {
      if (sub in BUNDLED_STDLIB_VIRTUAL) {
        return BUNDLED_STDLIB_VIRTUAL[sub as BundledStdlibSubpath];
      }
      return null;
    },
    load(id) {
      return BROWSER_VIRTUAL_MODULES[id] ?? null;
    },
  });
}
