import { correctTranscript, projectMappedCaptions, type Transcript, type TranscriptSource } from "@foxworth/superimg/transcript";
import { transcribe, type TranscriptionAdapter } from "@foxworth/superimg-node/transcription";
import { extractFrames, extractWaveform, detectSilence, prepareCuts, exportCuts } from "@foxworth/superimg-node/media-preparation";
import { NodeEditEngine, previewNodeEdit } from "@foxworth/superimg-node/edit";
import { inspectFile } from "@foxworth/superimg/runtime";
import { loadNodeMediaValue } from "@foxworth/superimg-node/source";
void loadNodeMediaValue;
async function consumer(bytes: Uint8Array) {
  const inspection = await inspectFile({ kind: "bytes", bytes });
  const trackId = inspection.tracks.find(track => track.kind === "audio")!.id;
  const adapter: TranscriptionAdapter = async ({ source }) => ({ schemaVersion: 1, source, revision: "one", timeUnit: "seconds", spans: [] });
  const transcript: Transcript = await transcribe({ bytes, inspection, trackId }, adapter);
  const corrected = correctTranscript(transcript, [], { expectedRevision: transcript.revision, revision: "two" }).transcript;
  const source: TranscriptSource = corrected.source;
  const plan = await prepareCuts({ kind: "bytes", bytes }, { source, ranges: [{ startSeconds: 0, endSeconds: 1 }], audioTrackId: source.trackId, videoTrackId: "video", quantization: "nearest" });
  const cues = projectMappedCaptions(corrected, plan.acceptedMap).cues;
  const cut = await exportCuts({ kind: "bytes", bytes }, { plan });
  const cutStream: ReadableStream<Uint8Array> = cut.artifact.open();
  await cut.artifact.dispose();
  void cutStream;
  const waveform = await extractWaveform({ kind: "bytes", bytes }, { trackId, bins: 8 });
  const silence = detectSilence(waveform, { threshold: 0.01, minDurationSeconds: 0.1 });
  const frames = await extractFrames({ kind: "bytes", bytes }, { trackId: "video", timesSeconds: [0], width: 32, height: 32 });
  frames.dispose(); return { cues, silence };
}
void consumer;

async function editConsumer(projectRoot: string) {
  const engine = new NodeEditEngine({ projectRoot });
  const bindings = await engine.bindings("scene.media.ts", {});
  const x = bindings.manifest.bindings.find(b => b.propertyPath === "initial.transform.x")!;
  const y = bindings.manifest.bindings.find(b => b.propertyPath === "initial.transform.y")!;
  const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-transform" as const, target: { nodeId: x.targetId, xBindingId: x.bindingId, yBindingId: y.bindingId }, value: { x: 1, y: 2 }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } };
  const plan = await engine.plan(command, {}); const preview = await previewNodeEdit(engine, command, {}, { targets: ["320x180.png"] });
  await preview.dispose(); return engine.apply(plan, {});
}
void editConsumer;
