/** The existing browser benchmark has a focused, source-pinned runtime mode. */
declare const __SUPERIMG_RUNTIME_BENCH__: boolean;

if (typeof __SUPERIMG_RUNTIME_BENCH__ !== "undefined" && __SUPERIMG_RUNTIME_BENCH__) {
  void import("./runtime-browser.js").then(({ installRuntimeBench }) => installRuntimeBench());
} else {
  void import("./browser-capture.js");
}
