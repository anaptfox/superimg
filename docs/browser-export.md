# Browser export

Import capture helpers from `@foxworth/superimg/browser-export` in browser code. They return
Blobs without downloading a file or writing the clipboard.

```ts
import { captureBrowserArtifact, captureHtmlArtifact } from "@foxworth/superimg/browser-export";

const png = await captureBrowserArtifact(element, {
  width: 1200, height: 630, dpr: 2, format: "png", embedFonts: "auto",
});
const fromHtml = await captureHtmlArtifact("<h1>Hello</h1>", {
  width: 1200, height: 630, dpr: 1, format: "png",
});
```

`element` must be a mounted DOM element. HTML-string capture activates a temporary
offscreen mount in the current document and accepts trusted HTML. Sanitize
untrusted content before calling it. Its temporary content is cleaned up after
capture.

The final raster dimensions are `width × scale × dpr` and
`height × scale × dpr`, rounded down. A capture `region` supplies the logical
width and height when present. DPR defaults to 2; use 1 for CSS-pixel output.
PNG capture checks the encoded dimensions and fails if the browser shrinks them.
Oversized PNG uses bounded raster windows when `CompressionStream` is available.
JPEG, WebP and ImageData capture retain single-canvas limits.

## Editable SVG and PDF

```ts
const svg = await captureBrowserArtifact(element, {
  width: 1200, height: 630, dpr: 1, format: "vector-svg",
});
const pdf = await captureBrowserArtifact(element, {
  width: 1200, height: 630, dpr: 1, format: "pdf",
});
```

`vector-svg` emits supported editable shapes and text. Complex paints may differ
from raster output. Ordinary `format: "svg"` preserves HTML using `foreignObject`.
The published browser export bundles the vector and PDF plugins from
`@zumer/snapdom-vector` and `@zumer/snapdom-pdf` and loads them on demand.
Vector geometry and PDF dimensions use logical pixels. DPR affects raster output.

For Figma, prepare the vector capture before the user clicks. Keep its source
connected until export finishes, then dispose the prepared capture when finished:

```ts
import { prepareBrowserVector } from "@foxworth/superimg/browser-export";

const prepared = await prepareBrowserVector(element, { width: 1200, height: 630 });
copyButton.addEventListener("click", async () => {
  try {
    await prepared.copyToFigma();
  } catch (error) {
    showCopyError(error); // Browser activation/clipboard policy can reject the copy.
  }
});
// On teardown: prepared.dispose(); remove the click listener with the component.
```

`copyToFigma()` is the only clipboard-writing helper and requires active user
activation. `prepared.toSvg()` returns a Blob without a clipboard operation.

## Capture from a media session

`createBrowserExporter(session, options)` exposes `captureArtifact(frame, options)`
alongside its existing ImageData and video methods. It serializes frame changes
and captures on the session's single DOM surface. Disposal drains active capture
work, rejects queued requests, and releases owned resources. An injected capture
backend remains caller-owned.

Captures bypass SnapDOM's automatic DOM memoization to retain fresh canvas, video,
and WebGL pixels. SuperImg's optional `burst` cache holds at most one repeat frame
and excludes independently changing pixel resources. Resource caching defaults to
`disabled`; `soft` and `full` are opt-in. Keep the DOM stable during capture
because DOM changes can affect the captured image.

## Capture with evidence

`captureBrowserArtifactWithEvidence(element, options)` accepts the same capture
and format options and returns `{ output: Blob, evidence }`. Existing
`captureBrowserArtifact` and ImageData methods keep their return types.

Evidence retains SnapDOM warnings after export, detached authoritative geometry,
requested sizing, actual PNG dimensions, bounded frozen context, and local
capture/encode durations. Actual dimensions are null when the selected encoded
format lacks a bounded header probe. Context is loaded per capture only for this
richer path; ordinary capture does not load the context plugin. Context refs and
rounded boxes supplement SuperImg semantic identities. The host supplies accepted
source/frame identity and must verify it around capture.
