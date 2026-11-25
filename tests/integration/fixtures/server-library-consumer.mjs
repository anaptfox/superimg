import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioSample, AudioSampleSink, AudioSampleSource, ALL_FORMATS, BufferSource, BufferTarget, Input, Mp4OutputFormat, Output, Quality, VideoSample, VideoSampleSink, VideoSampleSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import sharp from "sharp";
import { Fill, Frame, Text, Video, video } from "@foxworth/superimg";
import { exportMedia, inspectFile, render, shutdown } from "@foxworth/superimg/runtime";
import { correctTranscript, exportSubtitles, importSubtitles, projectMappedCaptions } from "@foxworth/superimg/transcript";
import { transcribe } from "@foxworth/superimg-node/transcription";
import { detectSilence, extractFrames, extractWaveform, prepareCuts, exportCuts } from "@foxworth/superimg-node/media-preparation";
import { NodeEditEngine, previewNodeEdit } from "@foxworth/superimg-node/edit";
import { loadNodeMediaValue } from "@foxworth/superimg-node/source";

registerMediabunnyServer();
async function sourceFixture() {
  const target = new BufferTarget(); const out = new Output({ format: new Mp4OutputFormat(), target });
  const videoTrack = new VideoSampleSource({ codec: "avc", quality: new Quality("high") });
  const audioTrack = new AudioSampleSource({ codec: "aac", quality: new Quality("high") });
  out.addVideoTrack(videoTrack); out.addAudioTrack(audioTrack); await out.start();
  for (let i = 0; i < 12; i++) {
    const rgba = new Uint8Array(64 * 64 * 4);
    for (let p = 0; p < rgba.length; p += 4) { rgba[p + (i < 4 ? 0 : i >= 8 ? 2 : 1)] = 220; rgba[p + 3] = 255; }
    const frame = new VideoSample(rgba, { format: "RGBA", codedWidth: 64, codedHeight: 64, timestamp: i / 4, duration: 0.25 });
    try { await videoTrack.add(frame); } finally { frame.close(); }
  }
  const pcm = new Float32Array(24000); for (let i = 0; i < pcm.length; i++) if (i < 8000 || i >= 16000) pcm[i] = 0.4 * Math.sin(i * 2 * Math.PI * (i < 8000 ? 440 : 660) / 8000);
  const sample = new AudioSample({ data: pcm, format: "f32", sampleRate: 8000, numberOfChannels: 1, timestamp: 0 });
  try { await audioTrack.add(sample); } finally { sample.close(); }
  await out.finalize(); return new Uint8Array(target.buffer);
}
async function pixels(bytes, time) {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  try { const track = await input.getPrimaryVideoTrack(); assert.ok(track); const sample = await new VideoSampleSink(track).getSample(time); assert.ok(sample); try { const rgba = new Uint8Array(sample.codedWidth * sample.codedHeight * 4); await sample.copyTo(rgba, { format: "RGBA" }); return { rgba, width: sample.codedWidth, height: sample.codedHeight, timestamp: sample.timestamp }; } finally { sample.close(); } } finally { input.dispose(); }
}
async function audioEnergy(bytes, start, end) {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) }); let sum = 0, count = 0;
  try { const track = await input.getPrimaryAudioTrack(); assert.ok(track); for await (const sample of new AudioSampleSink(track).samples(start, end)) { try { const pcm = new Float32Array(sample.numberOfFrames * sample.numberOfChannels); sample.copyTo(pcm, { format: "f32", planeIndex: 0 }); for (let i = 0; i < sample.numberOfFrames; i++) { const t = sample.timestamp + i / sample.sampleRate; if (t >= start && t < end) for (let c = 0; c < sample.numberOfChannels; c++) { sum += pcm[i * sample.numberOfChannels + c] ** 2; count++; } } } finally { sample.close(); } } } finally { input.dispose(); }
  assert.ok(count); return Math.sqrt(sum / count);
}
function whitePixels(pixel) { let count = 0; for (let y = 130; y < pixel.height; y++) for (let x = 0; x < pixel.width; x++) { const p = (y * pixel.width + x) * 4; if (pixel.rgba[p] > 190 && pixel.rgba[p + 1] > 190 && pixel.rgba[p + 2] > 190) count++; } return count; }
function channel(pixel, c) { const p = (10 * pixel.width + 10) * 4; return pixel.rgba[p + c]; }
async function editJourney() {
  const path = resolve("editable.media.ts");
  const authored = `import { image, Frame, Fill, Text } from '@foxworth/superimg'; export default image({ size:{width:320,height:180}, render:()=>Frame({width:320,height:180}, Fill({color:'#101828'}), Frame({id:'title',x:10,y:20,width:200,height:60},Text({id:'word',color:'#fff',size:20},'Hello'))) });`;
  await writeFile(path, authored); const engine = new NodeEditEngine({ projectRoot: process.cwd() }); const bindings = await engine.bindings("editable.media.ts", {});
  const x = bindings.manifest.bindings.find(b => b.propertyPath === "initial.transform.x" && b.targetId.endsWith("title"));
  const y = bindings.manifest.bindings.find(b => b.propertyPath === "initial.transform.y" && b.targetId.endsWith("title")); assert.ok(x && y);
  const command = { schemaVersion: 0, source: "editable.media.ts", kind: "set-node-transform", target: { nodeId: x.targetId, xBindingId: x.bindingId, yBindingId: y.bindingId }, value: { x: 30, y: 40 }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } };
  const plan = await engine.plan(command, {}); const preview = await previewNodeEdit(engine, command, {}, { targets: ["320x180.png"] });
  try {
    assert.equal(preview.report.state, "proposed");
    assert.notEqual(preview.report.before.inputDigest, preview.report.after.inputDigest);
    const compared = await preview.compare(0, "png");
    assert.ok(compared[0].before && compared[0].after);
    assert.notDeepEqual(compared[0].before.bytes, compared[0].after.bytes);
  } finally { await preview.dispose(); }
  const result = await engine.apply(plan, {}); assert.equal((await engine.verify(plan, result, {})).ok, true);
  const after = await readFile(path, "utf8"); assert.match(after, /x:\s*30,\s*y:\s*40/); assert.ok(after.includes("'Hello'"));
  const reloaded = await engine.bindings("editable.media.ts", {}); assert.notDeepEqual(reloaded.sourceHashes, bindings.sourceHashes);
  const textBinding = reloaded.manifest.bindings.find(b => b.propertyPath === "text");
  assert.ok(textBinding, "literal Text child must expose an exact binding");
  const textCommand = { schemaVersion: 0, source: "editable.media.ts", kind: "set-node-text", target: { nodeId: textBinding.targetId, textBindingId: textBinding.bindingId }, value: { text: "Revised" }, expected: { intentHash: reloaded.manifest.intentHash, sourceHashes: { ...reloaded.sourceHashes } } };
  const textPlan = await engine.plan(textCommand, {});
  const textResult = await engine.apply(textPlan, {}); assert.equal((await engine.verify(textPlan, textResult, {})).ok, true);
  await assert.rejects(engine.plan(textCommand, {}), error => error.code === "SOURCE_STALE");
  const loaded = await loadNodeMediaValue(process.cwd(), "editable.media.ts");
  assert.match(await (await render(loaded.value, { as: "html" })).text(), /Revised/);
  return { before: bindings.manifest.intentHash, after: (await engine.bindings("editable.media.ts", {})).manifest.intentHash };
}
let frames; let bundle;
try {
  const bytes = await sourceFixture(); const input = { kind: "bytes", bytes }; const inspection = await inspectFile(input);
  const audio = inspection.tracks.find(t => t.kind === "audio"), picture = inspection.tracks.find(t => t.kind === "video"); assert.ok(audio && picture);
  const transcript = await transcribe({ bytes, inspection, trackId: audio.id }, async ({ source }) => ({ schemaVersion: 1, source, revision: "recognition-1", timeUnit: "seconds", provenance: { provider: "fixture" }, spans: [{ id: "w1", text: "Helo", granularity: "word", alignment: "recognized", timing: { startSeconds: 0.1, endSeconds: 0.65 } }, { id: "w2", text: "blue", granularity: "word", alignment: "recognized", timing: { startSeconds: 2.1, endSeconds: 2.65 } }] }));
  const corrected = correctTranscript(transcript, [{ kind: "text", id: "w1", text: "Hello" }, { kind: "timing", id: "w1", timing: { startSeconds: 0.1, endSeconds: 0.7 } }], { expectedRevision: "recognition-1", revision: "corrected-1" }).transcript;
  const vtt = exportSubtitles(corrected, "vtt"); assert.equal(importSubtitles(vtt.text, "vtt", corrected.source, "imported").transcript.spans[0].text, "Hello");
  const ranges = [{ startSeconds: 0, endSeconds: 0.75 }, { startSeconds: 2, endSeconds: 2.75 }]; const plan = await prepareCuts(input, { source: corrected.source, ranges, videoTrackId: picture.id, audioTrackId: audio.id, quantization: "nearest" }); const captions = projectMappedCaptions(corrected, plan.acceptedMap).cues;
  assert.deepEqual(captions.map(c => c.text), ["Hello", "blue"]); assert.ok(Math.abs(captions[1].startSeconds - 0.85) < 1e-8);
  const cut = await exportCuts(input, { plan });
  try {
    const cutBytes = new Uint8Array(await new Response(cut.artifact.open()).arrayBuffer());
    const cutInfo = await inspectFile({ kind: "bytes", bytes: cutBytes });
    assert.ok(Math.abs(cutInfo.durationSeconds - cut.artifact.durationSeconds) < 1e-6);
    assert.deepEqual(cut.ranges.map(range => range.output), [{ startSeconds: 0, endSeconds: 0.75 }, { startSeconds: 0.75, endSeconds: 1.5 }]);
    const first = await pixels(cutBytes, 0.25), second = await pixels(cutBytes, 1.0);
    assert.ok(channel(first, 0) > channel(first, 2) + 60 && channel(second, 2) > channel(second, 0) + 60);
    assert.ok(await audioEnergy(cutBytes, 0.1, 0.6) > 0.03 && await audioEnergy(cutBytes, 0.85, 1.35) > 0.03);
    await writeFile("server-library-cut.mp4", cutBytes);
  } finally { await cut.artifact.dispose(); }
  frames = await extractFrames(input, { trackId: picture.id, timesSeconds: [0.25, 2.25], width: 32, height: 32 }); assert.equal(frames.frames.length, 2);
  const waveform = await extractWaveform(input, { trackId: audio.id, bins: 30, startSeconds: 0, endSeconds: 3 });
  const silence = detectSilence(waveform, { threshold: 0.03, minDurationSeconds: 0.5 }); assert.ok(silence.intervals.some(i => i.startSeconds < 1.2 && i.endSeconds > 1.8));
  const audioSrc = `data:video/mp4;base64,${Buffer.from(bytes).toString("base64")}`;
  function authored(showCaption) { return video({ size: { width: 320, height: 180 }, fps: 4, duration: "1.5s", assets: { clip: { type: "video", bytes, mimeType: "video/mp4", width: 64, height: 64, duration: 3 } }, audio: { clips: ranges.map((r, i) => ({ id: `a${i}`, role: "voice", src: audioSrc, at: `${i * 0.75}s`, duration: "0.75s", trim: { in: `${r.startSeconds}s`, out: `${r.endSeconds}s` } })) }, render(ctx) { const t = ctx.timeline.seconds; const sourceTime = t < 0.75 ? t : t - 0.75 + 2; const caption = captions.find(c => t >= c.startSeconds && t < c.endSeconds); const sync = ctx.std.video.sync({ id: "footage", src: ctx.asset("clip"), at: sourceTime }, ctx.fps); return Frame({ width: 320, height: 180 }, Fill({ color: "#101828" }), Frame({ x: 0, y: 0, width: 320, height: 120 }, Video({ src: ctx.asset("clip"), html: sync.html, width: 320, height: 120, fit: "fill" })), ...(showCaption && caption ? [Frame({ x: 20, y: 130, width: 280, height: 40 }, Text({ color: "#ffffff", size: 28 }, caption.text))] : [])); } }); }
  const withText = await render(authored(true), { as: "png", at: "0.25s" }); const withoutText = await render(authored(false), { as: "png", at: "0.25s" });
  const a = await sharp(await withText.bytes()).raw().toBuffer(), b = await sharp(await withoutText.bytes()).raw().toBuffer(); assert.ok(a.some((value, index) => value !== b[index]), "corrected caption must change rendered pixels");
  bundle = await exportMedia(authored(true), { for: [{ id: "consumer", width: 320, height: 180, format: "mp4" }] }); const output = await bundle.artifacts[0].bytes(); await writeFile("server-library-output.mp4", output);
  const resultInfo = await inspectFile({ kind: "bytes", bytes: output }); assert.ok(Math.abs(resultInfo.durationSeconds - 1.5) < 0.3);
  const red = await pixels(output, 0.25), blue = await pixels(output, 1.0); assert.ok(channel(red, 0) > channel(red, 2) + 60); assert.ok(channel(blue, 2) > channel(blue, 0) + 60); assert.ok(whitePixels(red) > 10 && whitePixels(blue) > 10, "encoded frames must contain both caption beats");
  const energies = [await audioEnergy(output, 0.1, 0.6), await audioEnergy(output, 0.85, 1.35)]; assert.ok(energies.every(n => n > 0.03));
  const edit = await editJourney(); await writeFile("server-library-evidence.json", JSON.stringify({ source: inspection.sha256, output: resultInfo.sha256, captions, ranges, durationSeconds: resultInfo.durationSeconds, energies, edit }, null, 2));
  console.log("server library consumer passed");
} finally { frames?.dispose(); if (bundle) await bundle.dispose(); await shutdown(); }
