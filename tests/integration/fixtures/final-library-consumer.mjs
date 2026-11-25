import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareMediaInput, prepareCuts, exportCuts, extractFrames, extractWaveform } from '@foxworth/superimg-node/media-preparation';
import { projectMappedCaptions } from '@foxworth/superimg/transcript';
import { shutdown } from '@foxworth/superimg/runtime';
import { NodeEditEngine, compileNodeEditableSource, previewNodeEdit, hashEditSource } from '@foxworth/superimg-node/edit';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputBytes = await readFile('final-input.mp4');
const facts = { status: 'incomplete', inputSha256: hash(inputBytes) };
let calls = 0, frames, cut;
const fetcher = async () => {
  calls++;
  let offset = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (offset >= inputBytes.length) return controller.close();
    const end = Math.min(offset + 4096, inputBytes.length);
    controller.enqueue(inputBytes.subarray(offset, end)); offset = end;
  } }));
};
const prepared = await prepareMediaInput({ kind: 'url', url: 'https://fixture.invalid/input' }, { fetch: fetcher });
try {
  const info = await prepared.inspect();
  assert.equal(info.sha256, hash(inputBytes));
  assert.equal(prepared.sha256, info.sha256);
  const video = info.tracks.find(t => t.kind === 'video'), audio = info.tracks.find(t => t.kind === 'audio');
  assert.ok(video && audio && audio.durationSeconds);
  frames = await extractFrames(prepared, { trackId: video.id, timesSeconds: [1.25, 0.25, 1.25], width: 32, height: 32 });
  assert.deepEqual(frames.frames.map(f => f.requestedSeconds), [1.25, 0.25, 1.25]);
  const pixels = png => {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { input: png });
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.equal(result.stdout.length, 32 * 32 * 4);
    return [...result.stdout.subarray(0, 4)];
  };
  const framePixels = frames.frames.map(f => pixels(f.png));
  assert.ok(framePixels[0][2] > framePixels[0][0] + 60 && framePixels[1][0] > framePixels[1][2] + 60);
  assert.deepEqual(framePixels[0], framePixels[2]);
  const waveform = await extractWaveform(prepared, { trackId: audio.id, bins: 8, startSeconds: 0, endSeconds: 1.5 });
  assert.ok(waveform.bins.some(bin => bin.peak > 0.01));
  const source = { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds };
  const requested = [{ startSeconds: 0.123456, endSeconds: 0.75 }, { startSeconds: 1.125, endSeconds: 1.75 }];
  const plan = await prepareCuts(prepared, { source, ranges: requested, audioTrackId: audio.id, videoTrackId: video.id, quantization: 'nearest' });
  assert.equal(plan.clock.kind, 'audio-samples');
  assert.equal(plan.requestedRanges[0].startSeconds, 0.123456);
  const accepted = plan.acceptedMap.ranges;
  assert.ok(Math.abs((accepted[0].startSeconds - plan.clock.originSeconds) * plan.clock.ticksPerSecond - Math.round((accepted[0].startSeconds - plan.clock.originSeconds) * plan.clock.ticksPerSecond)) < 1e-7);
  assert.ok(Math.abs(plan.adjustments[0].startSeconds - (accepted[0].startSeconds - requested[0].startSeconds)) < 1e-12);
  const transcript = { schemaVersion: 1, source, revision: 'one', timeUnit: 'seconds', spans: [{ id: 'a', text: 'hello', granularity: 'word', alignment: 'recognized', timing: { startSeconds: 0.2, endSeconds: 0.3 } }] };
  const captions = projectMappedCaptions(transcript, plan.acceptedMap).cues;
  assert.ok(Math.abs(captions[0].startSeconds - (0.2 - accepted[0].startSeconds)) < 1e-9);
  const other = await prepareMediaInput({ kind: 'bytes', bytes: await readFile('avc-aac.mp4') });
  try { await assert.rejects(exportCuts(other, { plan })); } finally { await other.dispose(); }
  cut = await exportCuts(prepared, { plan, encoding: { format: 'mp4', video: { codec: 'avc' }, audio: { codec: 'aac' } } });
  assert.deepEqual(cut.ranges.map(r => r.source), accepted);
  const bytes1 = new Uint8Array(await new Response(cut.artifact.open()).arrayBuffer());
  await shutdown();
  const bytes2 = new Uint8Array(await new Response(cut.artifact.open()).arrayBuffer());
  assert.equal(hash(bytes1), cut.artifact.sha256); assert.equal(hash(bytes2), cut.artifact.sha256);
  assert.equal(bytes1.length, cut.artifact.byteLength);
  const decodeAt = (time, kind) => {
    const args = ['-v', 'error', '-i', 'pipe:0', '-ss', String(time)];
    if (kind === 'video') args.push('-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1');
    else args.push('-t', '0.15', '-f', 'f32le', '-ac', '1', 'pipe:1');
    const result = spawnSync('ffmpeg', args, { input: bytes1 });
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.ok(result.stdout.length > 0);
    return result.stdout;
  };
  const secondTime = accepted[0].endSeconds - accepted[0].startSeconds + 0.25;
  const red = decodeAt(0.25, 'video'), blue = decodeAt(secondTime, 'video');
  assert.ok(red[0] > red[2] + 60 && blue[2] > blue[0] + 60);
  const audioOutput = decodeAt(0.25, 'audio');
  let sum = 0;
  for (let i = 0; i + 4 <= audioOutput.length; i += 4) sum += audioOutput.readFloatLE(i) ** 2;
  const energy = Math.sqrt(sum / Math.floor(audioOutput.length / 4));
  assert.ok(energy > 0.01);
  const reader = cut.artifact.open().getReader();
  await cut.artifact.dispose();
  await assert.rejects(reader.read());
  assert.throws(() => cut.artifact.open(), /disposed/i);
  assert.equal(calls, 1);
  await prepared.dispose(); await assert.rejects(prepared.inspect(), /disposed/i);
  facts.media = { fetches: calls, sourceSha256: info.sha256, outputSha256: hash(bytes1), requested, accepted, adjustments: plan.adjustments, clock: plan.clock, captions, framePixels, outputPixels: [[...red.subarray(0, 4)], [...blue.subarray(0, 4)]], audioRms: energy, durationSeconds: cut.artifact.durationSeconds };
  await writeFile('final-library-facts.json', JSON.stringify(facts, null, 2));
  const editSource = "import {video,Frame,Fill,Text} from '@foxworth/superimg'; export default video({size:{width:320,height:180},fps:4,duration:'3s',render:ctx=>Frame({width:320,height:180},Fill({color:'#101828'}),...(ctx.timeline.frame===2?[Text({id:'flash',color:'#fff',size:48},'Before')]:[]))});";
  await writeFile('selected.media.ts', editSource);
  let writes = 0;
  const writer = { async withLock(work) { return work(); }, async replace({ absolutePath, expectedHash, source }) {
    if (hashEditSource(await readFile(absolutePath, 'utf8')) !== expectedHash) return 'conflict';
    await writeFile(absolutePath, source); writes++; return 'applied';
  } };
  const engine = new NodeEditEngine({ projectRoot: process.cwd(), writer });
  const binding = await engine.bindings('selected.media.ts', {});
  const selected = await compileNodeEditableSource(process.cwd(), { source: 'selected.media.ts', context: {} });
  const text = binding.manifest.bindings.find(b => b.propertyPath === 'text' && b.targetId.endsWith('::flash'));
  assert.ok(text);
  const command = { schemaVersion: 0, source: 'selected.media.ts', kind: 'set-node-text', target: { nodeId: text.targetId, textBindingId: text.bindingId }, value: { text: 'After' }, expected: { intentHash: binding.manifest.intentHash, sourceHashes: { ...binding.sourceHashes } }, observation: { frame: 2, coordinates: selected.coordinates } };
  const editPlan = await engine.plan(command, {});
  assert.equal(await readFile('selected.media.ts', 'utf8'), editSource); assert.equal(writes, 0);
  const preview = await previewNodeEdit(engine, command, {}, { targets: ['320x180.png'], adapter: { defaultFonts: false } });
  let beforeHash, afterHash;
  try {
    const [row] = await preview.compare(2, 'png');
    assert.ok(row.before && row.after); beforeHash = hash(row.before.bytes); afterHash = hash(row.after.bytes);
    const decoded = [row.before, row.after].map(side => spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { input: side.bytes }));
    for (const image of decoded) { assert.equal(image.status, 0); assert.equal(image.stdout.length, 320 * 180 * 4); }
    assert.notDeepEqual(decoded[0].stdout, decoded[1].stdout);
    const [html] = await preview.compare(2, 'html');
    assert.match(Buffer.from(html.before.bytes).toString(), /Before/); assert.match(Buffer.from(html.after.bytes).toString(), /After/);
    assert.equal(await readFile('selected.media.ts', 'utf8'), editSource); assert.equal(writes, 0);
  } finally { await preview.dispose(); }
  const result = await engine.apply(editPlan, {}); assert.equal((await engine.verify(editPlan, result, {})).ok, true);
  assert.equal(writes, 1); assert.match(await readFile('selected.media.ts', 'utf8'), /After/);
  const reloaded = await engine.bindings('selected.media.ts', {});
  const reloadedText = reloaded.manifest.bindings.find(b => b.propertyPath === 'text'); assert.equal(reloadedText.value, 'After');
  const reloadedSource = await compileNodeEditableSource(process.cwd(), { source: 'selected.media.ts', context: {} });
  const freshCommand = { ...command, target: { nodeId: reloadedText.targetId, textBindingId: reloadedText.bindingId }, value: { text: 'Before' }, expected: { intentHash: reloaded.manifest.intentHash, sourceHashes: { ...reloaded.sourceHashes } }, observation: { frame: 2, coordinates: reloadedSource.coordinates } };
  const reloadedPreview = await previewNodeEdit(engine, freshCommand, {}, { targets: ['320x180.png'], adapter: { defaultFonts: false } });
  try { const [row] = await reloadedPreview.compare(2, 'png'); assert.ok(row.before); assert.equal(hash(row.before.bytes), afterHash); } finally { await reloadedPreview.dispose(); }
  await assert.rejects(engine.apply(editPlan, {})); assert.equal(writes, 1);
  const inversePlan = await engine.plan(freshCommand, {}); const inverseResult = await engine.apply(inversePlan, {});
  assert.equal((await engine.verify(inversePlan, inverseResult, {})).ok, true); assert.equal(writes, 2);
  assert.equal((await engine.bindings('selected.media.ts', {})).manifest.bindings.find(b => b.propertyPath === 'text').value, 'Before');
  const clipSource = `import {video,Frame,Html} from '@foxworth/superimg'; export default video({size:{width:32,height:32},fps:4,duration:'1s',render:ctx=>Frame({id:'box',x:0,y:0,width:32,height:32},Html({id:'clip',width:32,height:32,html:ctx.std.video.sync({src:${JSON.stringify(resolve('avc-aac.mp4'))},at:ctx.timeline.seconds,width:32,height:32},ctx.fps).html}))});`;
  await writeFile('clip.media.ts', clipSource);
  const clipBindings = await engine.bindings('clip.media.ts', {});
  const x = clipBindings.manifest.bindings.find(b => b.targetId.endsWith('::box') && b.propertyPath === 'initial.transform.x');
  const y = clipBindings.manifest.bindings.find(b => b.targetId.endsWith('::box') && b.propertyPath === 'initial.transform.y'); assert.ok(x && y);
  const clipCommand = { schemaVersion: 0, source: 'clip.media.ts', kind: 'set-node-transform', target: { nodeId: x.targetId, xBindingId: x.bindingId, yBindingId: y.bindingId }, value: { x: 1, y: 0 }, expected: { intentHash: clipBindings.manifest.intentHash, sourceHashes: { ...clipBindings.sourceHashes } } };
  const clipPreview = await previewNodeEdit(engine, clipCommand, {}, { targets: ['32x32.png'], adapter: { defaultFonts: false } });
  let clipPixels;
  try { const [row] = await clipPreview.compare(1, 'png'); assert.ok(row.before && row.after); clipPixels = [row.before, row.after].map(side => { const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=32:32', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { input: side.bytes }); assert.equal(decoded.status, 0); return [...decoded.stdout.subarray((16 * 32 + 16) * 4, (16 * 32 + 16) * 4 + 4)]; }); assert.ok(clipPixels.every(p => p[0] > p[2] + 60)); } finally { await clipPreview.dispose(); }
  facts.edit = { frame: 2, target: text.targetId, coordinates: selected.coordinates, beforeHash, afterHash, writes, staleRejected: true, clipPixels };
  facts.status = 'passed';
  await writeFile('final-library-facts.json', JSON.stringify(facts, null, 2));
} finally {
  frames?.dispose();
  await cut?.artifact.dispose();
  await prepared.dispose();
  await shutdown();
}
