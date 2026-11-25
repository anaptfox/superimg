//! Internal browser compile graph for SuperImg's own React compile shell.
//! Not a public package export. Hosts that already have Rolldown/OXC compile
//! `*.media.ts` themselves; this file stays off player/runtime barrels.

export { initBundler, bundleTemplateBrowser } from "@superimg/core/bundler-browser";
