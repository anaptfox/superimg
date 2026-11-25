# Media jobs

SuperImg exposes media inspection, conversion, and authored export through the
runtime job API. A job is an in-memory, cooperative operation: pause and resume
apply while the host remains alive, and disposal cancels the work. The API does
not claim durable queue or restart semantics.

## Inspect a selected file

Use `inspectFile()` before presenting track controls. It returns a serializable
`MediaInspection` containing the MIME type, byte count, digest, duration, and
video/audio tracks with codec and stream metadata.
Use each returned track's `id` with the same source. Current IDs include a track
kind, such as `video:1` or `audio:2`. If a saved plan uses numeric IDs, probe
the original source again and select the intended tracks.

```ts
const inspection = await inspectFile({
  kind: "bytes",
  bytes: fileBytes,
  mimeType: file.type,
}, { runtime });
```

The equivalent local CLI command is `superimg media probe input.mp4 --json`.
For multi-source conversion, run `superimg media convert --plan conversion.json`.
The plan is inspected by source id before selected tracks are converted, and
the command reports the actual artifact MIME type and track decisions.

```json
{
  "sources": [{ "id": "camera", "path": "camera.mp4" }],
  "video": { "sourceId": "camera", "trackId": "video:1", "trim": { "endSeconds": 18 } },
  "audio": [],
  "format": "mkv",
  "resize": { "width": 1920, "height": 1080, "fit": "contain" },
  "encoding": { "video": { "quality": "high" } }
}
```

Plan source paths are resolved relative to the plan file. The CLI loads them as
host-owned bytes; source IDs and selected track IDs are validated before work
starts. Use `--output out.mkv` to choose a distinct output path.

The Studio keeps video and audio selection separate. A conversion request names
one video track and zero or more audio tracks, each with its own source trim.
Trims are validated against the inspected track duration.

```ts
const job = startConversion({
  sources: [{ id: "upload", input: { kind: "bytes", bytes: fileBytes } }],
  video: {
    sourceId: "upload",
    trackId: "video:1",
    trim: { startSeconds: 2, endSeconds: 18 },
  },
  audio: [{
    id: "main-audio",
    sourceId: "upload",
    trackId: "audio:1",
    trim: { startSeconds: 3, endSeconds: 17 },
  }],
  format: "mp4",
  resize: { width: 1920, height: 1080, fit: "contain" },
  encoding: {
    video: { quality: "high", codec: "avc" },
    audio: { quality: { bitrate: 192_000, mode: "variable" } },
  },
}, { runtime });
const artifact = await job.result;
```

`ConversionArtifact.open()` provides the output stream and its metadata records
the selected tracks and whether each was copied or transcoded. Node’s native
media lane currently provides MP4, WebM, MOV, and MKV containers; codec support
is resolved by the installed Mediabunny runtime. ProRes and DTS requests are
available only when that runtime reports support. Browser conversion is not a
general substitute for the Node lane, and browser-authored export does not
support authored audio timelines.

### Packet copying and video orientation

Set `copy` on a conversion request (or a CLI conversion plan) to choose how
compressed packets may cross trim boundaries:

```ts
const job = startConversion({
  sources: [{ id: "upload", input: { kind: "bytes", bytes: fileBytes } }],
  video: { sourceId: "upload", trackId: "video:1", trim: { startSeconds: 1.5, endSeconds: 3 } },
  audio: [],
  format: "mp4",
  copy: { mode: "preferred", boundaryPolicy: "expand", boundaryTolerance: 0.25 },
}, { runtime });
const artifact = await job.result;
try {
  // Consume artifact.open(); inspect artifact.tracks for actual copy/transcode decisions.
} finally {
  await artifact.dispose();
  await job.dispose();
}
```

`preferred` falls back to transcoding when copying cannot meet the request.
`required` rejects the conversion if any selected track would need transcoding
or would be discarded. `copy: false` always transcodes. Omitting `copy` preserves
the existing trimming policy: transcode when the first packet precedes the trim.

`expand` may retain packets outside the requested trim; `shrink` may omit media
inside it. `boundaryTolerance` limits deviation at the **start** of the trim in
seconds, with no limit by default. Container timing rules still apply, so neither
policy promises exact end boundaries. Only `shiftTolerance: 0` is supported to
keep independently selected tracks synchronized.

After execution, each track plan reports `outputStartSeconds` and
`outputEndSeconds`. With an explicit copy policy, `durationSeconds` reports the
observed output endpoint; without one it retains the requested trim span.
Check per-track bounds for negative preroll or a late start.

Set `video.flip: true` for horizontal mirroring. Set
`video.allowTransformationMetadata: false` to bake the transform into pixels;
otherwise supported containers can retain it as metadata. `inspectFile()` now
reports coded and display dimensions, rotation, flip, the transformation matrix,
and `canBeTransparent`. The transparency field is a format/codec hint, not a
pixel measurement.

For mounted DOM and trusted HTML file capture, see [Browser export](browser-export.md).

## Export authored media

`startExport()` accepts a deterministic authored media value and destination
targets. The runtime performs capability and codec preflight before rendering.

```ts
const job = startExport(media, {
  runtime,
  for: ["youtube"],
  encoding: {
    video: { codec: "avc", quality: "high", alpha: "discard" },
    capture: { dpr: 1, scale: "css", intermediate: "jpeg" },
  },
  onProgress(event) {
    console.log(event.state, event.item, event.work);
  },
});

const bundle = await job.result;
// Consume the artifact streams before releasing their storage.
await bundle.dispose();
await job.dispose();
```

Subscribe to `job.subscribe()` for state and frame/rendition progress. A failed
or cancelled job includes an error or reason. Cancellation after work may have
started does not imply that an external effect was rolled back; callers must
retain the job outcome and reconcile through their host when applicable.

## Output ownership

The standard Node runtime writes authored video and GIF exports to private
temporary files. A successful export bundle owns those files: each artifact's
`open()` creates an independent stream, and the manifest includes its byte count
and SHA-256 digest. The files remain readable after the runtime is disposed.
Call `bundle.dispose()` after consuming the streams to close active readers and
remove the files. Disposing the completed job also disposes its bundle.
Failed or cancelled exports release their temporary storage.

File output streams encoded packets in bounded chunks. MP4/MOV file output
defaults to a seekable file with its index written at the end; explicit
`mp4.fastStart: "in-memory"` is rejected because it would retain the movie in
memory. Use `false` or `"fragmented"` for file output.

Still exports, conversion artifacts, and browser exports still buffer their
output bytes. Authored audio also decodes and mixes complete audio buffers in
memory, then submits small audio chunks alongside video frames. File output
therefore avoids buffering a complete encoded movie without making the entire
pipeline constant-memory. Jobs remain in-process operations, not a durable
queue; temporary files are not a restart or recovery mechanism.

## Capture and encoding quality

Capture fidelity is separate from encoder quality. Explicit regions and
DPR/scale control screenshot density; they do not change the authored layout.
Node encoders validate the captured dimensions and resample the complete image
to the coded rendition dimensions with Lanczos filtering. A 1920×1080 video
captured at DPR 2 with device scale uses a 3840×2160 screenshot and still encodes
at 1920×1080. A capture region instead determines the coded width and height.

For editing masters, `PRORES_MASTER_ENCODING` and
`PRORES_MASTER_ALPHA_ENCODING` are exported by `@foxworth/superimg/runtime`. Their CLI
presets are `prores-master` and `prores-master-alpha`. Both use lossless PNG
capture; the alpha preset also preserves transparency. A ProRes authored export
must name a MOV custom target explicitly:

```sh
superimg export launch.media.ts --for 1920x1080.mov --preset prores-master
superimg export launch.media.ts --for 1920x1080.mov --preset prores-master-alpha
```

For Node authored video, `video.hardwareAcceleration: "prefer-hardware"`
together with a quality preset such as `"high"` negotiates bitrate-based quality
so that quantizer mode does not exclude VideoToolbox. An explicit quantizer is
preserved; combining it with `"prefer-hardware"` on macOS is rejected because
VideoToolbox does not support that mode. Preflight and encoding use the same
quality policy. Hardware preference is a request, not proof of hardware use.

Node video diagnostics in `bundle.manifest.metadata.encoding` report the codec,
coded dimensions, negotiated rate control, and requested hardware preference
after an encoded packet is produced. Actual native implementation and output
pixel format remain unspecified when the encoder does not expose them.

Capture caching is conservatively disabled by default. Enable `cache` only
for stable scenes; canvas, video, iframe, image URLs, SVG images and masks, and
pseudo-element image resources bypass the managed SnapDOM cache. The Node
Chromium path uses Chromium's lossless fast-PNG capture when PNG is selected.
The browser renderer rejects executable authored HTML such as inline scripts,
Three, and Lottie with an explicit Node-renderer direction instead of exporting
an unpainted frame. Browser output is limited to formats and codecs that
the current browser exposes. Authored CSS-animation mode and authored audio
timelines remain rejected by browser preflight; use the Node runtime for those
features.

Node and browser capture currently support sRGB and reject `display-p3` requests.
Neither higher DPR, PNG capture, nor a ProRes container increases source color
precision or creates HDR output.

A single-frame file whose only duration is container metadata can be copied or
transcoded on its own. Combining that ambiguous per-packet timing with additional
tracks is rejected before processing. Normal tracks with packet timing can be
assembled with separate audio tracks of unequal durations.
