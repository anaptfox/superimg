import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute, dirname, join } from 'node:path';

const order = process.argv[2];
assert.ok(['root-first', 'node-first'].includes(order));
let root, runtime, preparation;
const source = new Uint8Array(await readFile('avc-aac.mp4'));
const facts = [];
async function loadRoot() {
  root = await import('@foxworth/superimg');
  runtime = await import('@foxworth/superimg/runtime');
}
async function loadNode() {
  preparation = await import('@foxworth/superimg-node/media-preparation');
}
async function render() {
  const result = await runtime.render(root.video({ size: { width: 32, height: 32 }, fps: 4, duration: '0.5s', render: () => root.Frame({ width: 32, height: 32 }, root.Fill({ color: '#ff0000' })) }), { as: 'mp4' });
  const bytes = await result.bytes();
  assert.ok(bytes.length > 100);
  const info = await runtime.inspectFile({ kind: 'bytes', bytes });
  assert.equal(info.tracks.find(t => t.kind === 'video')?.codec, 'avc');
  facts.push('root-avc-render');
}
async function frames(path, alpha = false) {
  const bytes = new Uint8Array(await readFile(path));
  const input = await preparation.prepareMediaInput({ kind: 'bytes', bytes });
  try {
    const track = (await input.inspect()).tracks.find(t => t.kind === 'video');
    assert.ok(track);
    const result = await preparation.extractFrames(input, { trackId: track.id, timesSeconds: [0.1], width: 16, height: 16 });
    try {
      assert.equal(result.frames.length, 1);
      const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { input: result.frames[0].png });
      assert.equal(decoded.status, 0, decoded.stderr?.toString());
      assert.equal(decoded.stdout.length, 16 * 16 * 4);
      const [r, , b, a] = decoded.stdout.subarray(0, 4);
      assert.ok(r > b + 80, `${path}: ${r},${b}`);
      if (alpha) assert.ok(a > 30 && a < 200, `${path} alpha ${a}`); else assert.equal(a, 255);
      facts.push(`frames:${path}:${track.codec}`);
    } finally { result.dispose(); }
  } finally { await input.dispose(); }
}
async function convert() {
  const info = await runtime.inspectFile({ kind: 'bytes', bytes: source });
  const video = info.tracks.find(t => t.kind === 'video');
  const audio = info.tracks.find(t => t.kind === 'audio');
  assert.equal(video?.codec, 'avc'); assert.equal(audio?.codec, 'aac');
  const artifact = await runtime.startConversion({ sources: [{ id: 'source', input: { kind: 'bytes', bytes: source } }], video: { sourceId: 'source', trackId: video.id }, audio: [{ id: 'audio', sourceId: 'source', trackId: audio.id }], format: 'mov', copy: false, encoding: { video: { codec: 'prores', quality: 'high' }, audio: { codec: 'aac' } } }).result;
  try {
    const bytes = new Uint8Array(await new Response(artifact.open()).arrayBuffer());
    const converted = await runtime.inspectFile({ kind: 'bytes', bytes });
    assert.equal(converted.tracks.find(t => t.kind === 'video')?.codec, 'prores');
    assert.equal(converted.tracks.find(t => t.kind === 'audio')?.codec, 'aac');
    facts.push('root-prores-aac-conversion');
  } finally { await artifact.dispose(); }
}
async function waveform() {
  const bytes = new Uint8Array(await readFile('dts.mka'));
  const input = await preparation.prepareMediaInput({ kind: 'bytes', bytes });
  try {
    const track = (await input.inspect()).tracks.find(t => t.kind === 'audio');
    assert.equal(track?.codec, 'dts');
    const result = await preparation.extractWaveform(input, { trackId: track.id, bins: 4 });
    assert.ok(result.bins.every(bin => bin.samples > 0 && bin.peak > 0.01));
    facts.push('dts-waveform');
  } finally { await input.dispose(); }
}
try {
  if (order === 'root-first') { await loadRoot(); await render(); await convert(); await loadNode(); }
  else { await loadNode(); }
  await frames('avc-aac.mp4'); await frames('opaque.mov'); await frames('alpha.mov', true); await waveform();
  if (order === 'node-first') { await loadRoot(); await render(); await convert(); }
  const rootRequire = createRequire(import.meta.resolve('@foxworth/superimg/runtime'));
  const nodeRequire = createRequire(import.meta.resolve('@foxworth/superimg-node/media-preparation'));
  const resolutions = {};
  const insideConsumer = path => { const rel = relative(process.cwd(), realpathSync(path)); assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel), `${path} escapes consumer`); return realpathSync(path); };
  resolutions.root = insideConsumer(fileURLToPath(import.meta.resolve('@foxworth/superimg')));
  resolutions.node = insideConsumer(fileURLToPath(import.meta.resolve('@foxworth/superimg-node/edit')));
  for (const name of ['mediabunny', '@mediabunny/server', '@mediabunny/dts']) {
    const path = insideConsumer(rootRequire.resolve(name));
    assert.equal(path, insideConsumer(nodeRequire.resolve(name)), `${name} resolves to different graphs`);
    resolutions[name] = path;
  }
  for (const name of ['node-av', 'playwright', 'typescript']) resolutions[name] = insideConsumer(createRequire(import.meta.url).resolve(name));
  const decoderRequire = createRequire(join(dirname(fileURLToPath(import.meta.resolve('@foxworth/superimg-node/edit'))), 'chunks/persistent-frame-decoder.js'));
  const serverRequire = createRequire(nodeRequire.resolve('@mediabunny/server'));
  resolutions.decoderNodeAv = insideConsumer(decoderRequire.resolve('node-av'));
  resolutions.serverNodeAv = insideConsumer(serverRequire.resolve('node-av'));
  assert.equal(resolutions.decoderNodeAv, resolutions.serverNodeAv, 'decoder and media server must share node-av');
  console.log(JSON.stringify({ order, facts, resolutions }));
} finally { await runtime?.shutdown(); }
