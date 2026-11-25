# SuperImg for Kotlin & Android

Native Kotlin Multiplatform & Jetpack Compose renderer for SuperImg `DisplayList v1` frames and `.superimg/` compiled artifacts.

## What this package provides

- **`DisplayList.kt`** (`commonMain`): Canonical `@Serializable` models for `@foxworth/superimg/display-list` (`schemaVersion = 1`), strict `validate()`, hex `#rrggbb[aa]` color parsing, and JSON serialization.
- **`ArtifactManifest.kt`** (`commonMain` + `jvmMain`/`androidMain`): `.superimg/` directory loader and cryptographic SHA-256 verifier (`artifact.json`, `media.json`, `job.json`, `program.mjs`, `assets/`, `fonts/`, path-traversal guard).
- **`JsRuntime.kt`** (`commonMain`): `SuperImgJsEngine` / `QuickJsEngineAdapter` contract, `SuperImgArtifactSession` driving `globalThis.__superimgNative.{loadArtifact, sampleArtifact, disposeArtifact}`, `CoalescedFrameScheduler` (single-in-flight, latest-pending discipline), and `SuperImgBenchmark` frame timing collector.
- **`SvgPathParser.kt`** (`commonMain`): Pure-Kotlin SVG `d` path parser (`M/L/H/V/C/S/Q/T/A/Z`) with W3C elliptical-arc-to-cubic conversion.
- **`SuperImgCanvas.kt`** (`androidMain`): Jetpack Compose composable rendering `DisplayListFrame` via Android `Canvas` (solid/linear/radial gradients, rounded rects, ellipses, SVG paths, `cover`/`contain`/`fill` images + `pixelArt` nearest-neighbor sampling, pre-wrapped text with vendored `Typeface`, nested clips, 2D affine matrices, opacity, `multiply`/`screen`/`overlay` blend modes, and `onFrameApplied` anchor callbacks).
- **`SuperImgMediaCodecExporter.kt`** (`androidMain`): Offscreen hardware-accelerated H.264/MP4 exporter using `MediaCodec` + `MediaMuxer` + `Surface`.

## Quick Start (Jetpack Compose + QuickJS/Hermes)

1. Compile your portable SuperImg template into a `.superimg/` artifact bundle and place it in Android `assets/` or app files directory.
2. Implement `QuickJsEngineAdapter` with your preferred Android JS VM (`quickjs-kt`, `zipline`, or Hermes):

```kotlin
class MyQuickJsEngine(private val quickJs: QuickJs) : QuickJsEngineAdapter() {
    override suspend fun evalRawOnVmThread(script: String, sourceName: String): String? =
        withContext(vmDispatcher) { quickJs.evaluate(script, sourceName)?.toString() }

    override fun close() = quickJs.close()
}
```

3. Load the verified artifact and mount `SuperImgCanvas`:

```kotlin
val artifact = ArtifactLoader.loadDirectory(artifactDir.absolutePath)
val sprites = artifact.decodeImageSprites()
val typefaces = SuperImgTypefaceRegistry.fromArtifact(artifact, context.cacheDir)
val session = SuperImgArtifactSession.load(engine, artifact)

SuperImgCanvas(
    session = session,
    playback = SuperImgPlayback.Automatic(framesPerSecond = 60),
    sprites = sprites,
    typefaces = typefaces,
    onFrameApplied = { applied ->
        val talkAnchor = applied.anchor(entity = "nell", named = "talk")
        // Position Compose overlay controls at talkAnchor
    },
)
```

## On-Device MP4 Export

```kotlin
val exporter = SuperImgMediaCodecExporter()
val result = exporter.exportMp4(
    session = session,
    outputFile = File(context.cacheDir, "export.mp4"),
    options = MediaCodecExportOptions(
        sprites = sprites,
        typefaces = typefaces,
        onProgress = { done, total -> /* update progress UI */ },
    ),
)
```

## Tests

```sh
./gradlew :jvmTest
```

See [Cross-OS Architecture](../../docs/cross-os-architecture.md) for the full `DisplayList v1` schema, `__superimgNative` bridge specification, portability rules, and profiling playbook.
