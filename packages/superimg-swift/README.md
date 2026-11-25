# SuperImg for Swift

An iOS and iPadOS 18+ player for bundled SuperImg scenes. Add this folder as a local Swift package in Xcode and link the `SuperImg` product. SwiftPM also builds the JavaScriptCore scene sampler on macOS for focused tests.

## Bundle a scene

Start from [the Meadow scene](examples/meadow.ts). Import the authoring helper from [authoring.ts](authoring.ts) and give it a function that turns the sample time, current viewport, and host state into a SuperImg `Scene`. That keeps the existing scene projection, ordering, and anchors. Build the entry into one JS resource during development or as an Xcode build step. From the SuperImg checkout root, with workspace dependencies installed:

```sh
packages/superimg-core/node_modules/.bin/rolldown \
  packages/superimg-swift/examples/meadow.ts \
  --platform neutral --format iife --file /tmp/meadow.js
```

Add the resulting JS file to the app target’s Copy Bundle Resources. Load it by resource name. All first-party code and named sprite resources ship with the app. The library evaluates the bundle using system JavaScriptCore. The sampler runs serially in a scene actor, and UIKit owns the view and layer updates.

## Mount in UIKit

```swift
import SuperImg
import UIKit

struct MeadowState: Encodable, Sendable {
    let nellX: Double
    let previousX: Double
    let acceptedTime: Double
}

@MainActor
func mountMeadow(in parent: UIView, sprite: CGImage) async throws -> SuperImgPlayer<MeadowState> {
    let scene = try await SuperImgScene<MeadowState>.load("meadow")
    let canvas = SuperImgCanvas(frame: parent.bounds)
    canvas.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    parent.insertSubview(canvas, at: 0)
    let state = MeadowState(nellX: 120, previousX: 120, acceptedTime: 0)
    let player = SuperImgPlayer(scene: scene, state: state)
    canvas.onFrameApplied = { frame in
        // Move the host’s overlay using frame.anchor(entity: "nell", named: "talk").
        // The anchor is in canvas-local points. A missing anchor can hide the control.
    }
    canvas.playback = .automatic(framesPerSecond: 60)
    canvas.mount(player, sprites: ["nell": .init(image: sprite, pixelArt: true)])
    return player
}
```

After accepting and saving a move, send the next complete visual snapshot with `player.update(state)`. Put any authored transition cue into that snapshot. Use `canvas.seconds` for a cue’s timestamp. Keep touch, actions, persistence, and accessibility in the host. Automatic time is monotonic from mount and continues across view visibility changes. Use `.onDemand` and `requestFrame(at:)` to scrub or own the clock. Set `canvas.onError` to receive errors. SwiftUI apps can mount the same player with `SuperImgSurface`.

The view applies draw operations and emits anchors in one Core Animation transaction. One sample can run at a time and the latest pending request replaces earlier pending work. A change to state, view size or a manual seek invalidates older samples. The callback means the layers were updated for compositor submission. Hardware scan-out has its own timing.

## Supported paint

One clipped spatial `Scene`, with one solid hex-filled rectangle, circle, or ellipse, or a fill-fit bitmap `Image` per part. Image `src` values are keys in the Swift sprite table. Keep image parts inside their authored bounds. The projection carries stable IDs, affine transforms, opacity, draw order, and visible anchors. Core Animation retains sprite and shape layers across frames. Rasterize complex static art into sprites before bundling. The desktop HTML/SVG renderers cover broader authored features including text, general vector paths, filters, and video. The native projector reports the ID of unsupported paint. Video export is outside this package’s first playback slice.

## Checks

```sh
swift test --package-path packages/superimg-swift
pnpm exec vitest run packages/superimg-swift/authoring.test.ts packages/superimg-stdlib/src/tree/scene.test.ts
```

Open `Package.swift` in Xcode and test the `SuperImg` scheme on iPhone and iPad simulators to exercise the UIKit canvas.
