import { prepareMediaInput, prepareCuts, exportCuts, extractFrames, extractWaveform, type PreparedCutPlan, type PreparedMediaInput } from "@foxworth/superimg-node/media-preparation";
import { projectMappedCaptions, type Transcript, type TranscriptSource } from "@foxworth/superimg/transcript";
import { NodeEditEngine, compileNodeEditableSource, previewNodeEdit, type NodeEditWriter } from "@foxworth/superimg-node/edit";

// Compiled against the installed packages, not executed by the type checker.
async function consumer(bytes: Uint8Array): Promise<void> {
  const prepared: PreparedMediaInput = await prepareMediaInput({ kind: "bytes", bytes });
  try {
    const info = await prepared.inspect();
    const audio = info.tracks.find(track => track.kind === "audio");
    const video = info.tracks.find(track => track.kind === "video");
    if (!audio || !video || audio.durationSeconds === undefined) throw new Error("Fixture needs audio and video");
    const source: TranscriptSource = { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds };
    const plan: PreparedCutPlan = await prepareCuts(prepared, { source, ranges: [{ startSeconds: 0.123456, endSeconds: 0.75 }], audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest" });
    const transcript: Transcript = { schemaVersion: 1, source, revision: "one", timeUnit: "seconds", spans: [{ id: "a", text: "hello", granularity: "word", alignment: "recognized", timing: { startSeconds: 0.2, endSeconds: 0.3 } }] };
    const cues = projectMappedCaptions(transcript, plan.acceptedMap).cues;
    const frames = await extractFrames(prepared, { trackId: video.id, timesSeconds: [0.2], width: 16, height: 16 });
    frames.dispose();
    const waveform = await extractWaveform(prepared, { trackId: audio.id, bins: 8 });
    const cut = await exportCuts(prepared, { plan });
    const stream: ReadableStream<Uint8Array> = cut.artifact.open();
    await cut.artifact.dispose();
    void [cues, waveform, stream, plan.adjustments, plan.clock];
  } finally { await prepared.dispose(); }
}
void consumer;

async function editConsumer(writer: NodeEditWriter): Promise<void> {
  const engine = new NodeEditEngine({ projectRoot: process.cwd(), writer });
  const bindings = await engine.bindings("selected.media.ts", {});
  const selected = await compileNodeEditableSource(process.cwd(), { source: "selected.media.ts", context: {} });
  const binding = bindings.manifest.bindings.find(item => item.propertyPath === "text");
  if (!binding) throw new Error("No text binding");
  const command = { schemaVersion: 0 as const, source: "selected.media.ts", kind: "set-node-text" as const, target: { nodeId: binding.targetId, textBindingId: binding.bindingId }, value: { text: "After" }, observation: { frame: 2, coordinates: selected.coordinates }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } };
  const plan = await engine.plan(command, {});
  const preview = await previewNodeEdit(engine, command, {}, { targets: ["320x180.png"] });
  try { await preview.compare(2, "png"); } finally { await preview.dispose(); }
  const output = await engine.apply(plan, {});
  await engine.verify(plan, output, {});
}
void editConsumer;
