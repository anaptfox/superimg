import { createHash } from "node:crypto";
import { selectMediaTrack, type MediaInspection } from "@superimg/types";
import { validateTranscript, type Transcript, type TranscriptSource } from "@superimg/stdlib/cue";

/** The host owns the adapter, credentials, admission and remote-effect reconciliation. */
export type TranscriptionAdapter = (input: Readonly<{ bytes: Uint8Array; source: TranscriptSource }>, options: Readonly<{ signal?: AbortSignal }>) => Promise<Transcript>;

/** Transcribe the exact inspected bytes and audio track once; never retries. */
export async function transcribe(input: Readonly<{ bytes: Uint8Array; inspection: MediaInspection; trackId: string }>, adapter: TranscriptionAdapter, options: Readonly<{ signal?: AbortSignal }> = {}): Promise<Transcript> {
  options.signal?.throwIfAborted();
  if (!(input.bytes instanceof Uint8Array)) throw new TypeError("Transcription requires inspected media bytes");
  const bytes = input.bytes.slice();
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (input.inspection.sha256 !== digest || input.inspection.byteLength !== bytes.byteLength) throw new TypeError("Media inspection does not match input bytes");
  const track = selectMediaTrack(input.inspection, input.trackId, "audio");
  if (!track) throw new TypeError("Select one inspected audio track");
  const durationSeconds = track.durationSeconds;
  if (durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new TypeError("Selected track requires a known duration");
  const source: TranscriptSource = { mediaSha256: digest, trackId: input.trackId, durationSeconds };
  const result = await adapter({ bytes, source: { ...source } }, options.signal ? { signal: options.signal } : {});
  options.signal?.throwIfAborted();
  validateTranscript(result);
  if (result.source.mediaSha256 !== source.mediaSha256 || result.source.trackId !== source.trackId || result.source.durationSeconds !== source.durationSeconds) throw new TypeError("Transcription result source does not match selection");
  return { ...result, source: { ...result.source }, ...(result.provenance ? { provenance: { ...result.provenance } } : {}), spans: result.spans.map(span => ({ ...span, ...(span.timing ? { timing: { ...span.timing } } : {}) })) };
}
