# Transcripts and captions

`@foxworth/superimg/transcript` provides portable transcript values and pure edits.
`@foxworth/superimg-node/transcription` calls a transcriber supplied by your application.
Your application owns credentials, provider selection, storage, and publication.

## Recognize inspected audio

```ts
import { inspectFile } from '@foxworth/superimg/runtime';
import { transcribe, type TranscriptionAdapter } from '@foxworth/superimg-node/transcription';

async function recognize(bytes: Uint8Array, adapter: TranscriptionAdapter) {
  const inspection = await inspectFile({ kind: 'bytes', bytes });
  const audio = inspection.tracks.find(track => track.kind === 'audio');
  if (!audio) throw new Error('This source has no audio');
  return transcribe({ bytes, inspection, trackId: audio.id }, adapter);
}
```

The adapter receives owned bytes, source identity, and an optional abort signal.
It returns a `Transcript` with the same source, a revision, and stable span IDs.
Spans declare `word`, `segment`, or `unknown` granularity and optional timing in
seconds. Missing word alignment stays missing. The library validates the result
and calls the adapter once. Cancellation does not authorize a retry or prove
that a remote request had no effect.

## Correct data and project captions

```ts
import { correctTranscript, projectCaptions, exportSubtitles } from '@foxworth/superimg/transcript';

const { transcript: corrected, mapping } = correctTranscript(transcript, [
  { kind: 'text', id: 'word-1', text: 'Hello' },
  { kind: 'timing', id: 'word-1', timing: { startSeconds: 0.1, endSeconds: 0.7 } },
], { expectedRevision: transcript.revision, revision: 'correction-2' });

const { cues, unmappedIds } = projectCaptions(corrected, {
  maxCharsPerLine: 32, maxLines: 2, maxGapSeconds: 0.5,
});
const subtitles = exportSubtitles(corrected, 'vtt');
```

Edits return a new value. Text correction retains recognition evidence separately
and does not claim fresh alignment. Split and merge commands return explicit ID
mappings; callers supply new IDs and any replacement timing. Revision checks
compare the supplied value. Your storage layer owns concurrent-save checks.

Grouping respects gaps, overlaps, missing timing, speakers, languages, and cue
settings. An unbreakable word is retained intact. Without grouping options there
is one cue per timed span. `projectWords` returns only spans with word timing.
Both projections report IDs they could not map.

`importSubtitles` and `exportSubtitles` support SRT and VTT, normalize milliseconds
to explicit seconds, and report losses. Subtitle files do not preserve the full
source identity, revision, recognition evidence, or speaker metadata. Imported
sentence cues do not become aligned words.

## Keep ranges on one shared clock

```ts
import { createKeptRangeMap, projectMappedCaptions } from '@foxworth/superimg/transcript';

const map = createKeptRangeMap(corrected.source, [
  { startSeconds: 2, endSeconds: 4 },
  { startSeconds: 6, endSeconds: 8 },
]);
const captions = projectMappedCaptions(corrected, map);
```

Ranges are ordered, disjoint, half-open intervals from one source at normal
speed. This example maps to output intervals `[0, 2)` and `[2, 4)`. Caption spans
are intersected with those ranges; removed and untimed IDs are reported. Pieces
crossing cuts carry clipping evidence rather than a claim of realignment.
`suggestFillerCuts` proposes ranges for supplied filler words; the host decides
which suggestions to accept.

For footage cuts, prepare a Node cut plan and project captions with its accepted map before calling `exportCuts`. See
[server media preparation](server-media-preparation.md) for selected tracks,
sample-aligned boundaries, output timing, and resource ownership. Transcript
correction edits data; it does not rewrite a media source file.
