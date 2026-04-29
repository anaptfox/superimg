//! SuperImg - Browser bundler entry point
//! Separated from the main browser entry to avoid pulling esbuild-wasm
//! into applications that don't need template compilation (e.g. just playback).

export { initBundler, bundleTemplateBrowser } from "@superimg/core/bundler-browser";
