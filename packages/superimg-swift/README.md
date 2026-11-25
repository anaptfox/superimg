# SuperImg for Swift

Native Apple player and on-device exporter for **iOS 18+**, **iPadOS 18+**, and **macOS 13+** powered by system `JavaScriptCore`, `CoreGraphics`, `CoreText`, `CoreAnimation`, and `AVFoundation` — zero WebView, zero Chromium, zero Bare.

## Two ways to run SuperImg natively

### 1. Load a compiled `.superimg/` artifact (cross-OS `video()` / `image()` / `svg()`)

Compile any native-portable `*.media.ts` project once and open the exact same bundle on Web, macOS, iPadOS, and iOS:

```sh
superimg check examples/basics/hello-world/hello-world.media.ts --target native
superimg compile examples/basics/hello-world/hello-world.media.ts --target native -o HelloWorld.superimg
```

Add `HelloWorld.superimg` as a folder reference in your app bundle, then load and play or scrub it:

```swift
import SuperImg

let artifact = try await SuperImgArtifact.load(directory: artifactURL)
let player = await MainActor.run { SuperImgTimelinePlayer(artifact: artifact) }

// Live data patch & scrub — runs inside bundled JavaScriptCore
await MainActor.run {
    player.setDataPatch(#"{"title":"Cross-OS SuperImg"}"#)
    player.seek(toSeconds: 2.5)
}
```

Mount `player` in:
- **macOS:** `SuperImgMacCanvas` (`NSView`) or `SuperImgMacSurface` (`SwiftUI`)
- **iOS / iPadOS:** `SuperImgCanvas` (`UIView`) or `SuperImgSurface` (`SwiftUI`)

### 2. Export MP4 directly on device (`AVAssetWriter`, zero FFmpeg)

```swift
let mp4URL = try await SuperImgExporter.exportMP4(
    artifact: artifact,
    to: destinationURL,
    dataPatchJSON: #"{"title":"Rendered on Apple Silicon"}"#
)
```

### 3. Live app-driven `Scene` with atomic anchors (e.g. Sunday Meadow)

Existing `SuperImgScene<State>`, `SuperImgPlayer<State>`, `SuperImgCanvas`, and `SuperImgSurface` APIs remain 100% supported. Use `installSuperImgSampler` or `installSuperImgDisplayListSampler` from [authoring.ts](authoring.ts) when a scene is driven by live host state and needs `onFrameApplied` anchors synced in the same `CATransaction`.

## Supported DisplayList v1 Paint

Rendered via shared sRGB `SuperImgGraphicsRenderer` (`CoreGraphics` + `CoreText`):
- `rect` (solid fill, linear/radial gradients, corner radius, borders/strokes)
- `ellipse` (solid/gradient fill, stroke)
- `path` (full SVG `d` parser including elliptical arcs, fillRule, dashed strokes)
- `image` (`cover`, `contain`, `fill`, `pixelArt` nearest-neighbor, rounded clip)
- `text` (pre-wrapped lines from shared pure-JS `parseFontMetrics`, CoreText rendering with vendored `.ttf`/`.otf` registration)
- Nested `clips`, 2D affine `matrix`, `opacity`, `blendMode` (`normal`, `multiply`, `screen`, `overlay`), and spatial `anchors`.

Use `SuperImgBenchmark` / `SuperImgFrameMetrics` to measure per-frame sample + render times against 60fps/120fps budgets.

## Rebuilding the bundled JSC runtime & running checks

```sh
node packages/superimg-core/scripts/build-jsc-runtime.mjs
swift test --package-path packages/superimg-swift
pnpm exec vitest run packages/superimg-stdlib/src/tree/display-list.test.ts packages/superimg-runtime-conformance/src/cross-os.test.ts
```
