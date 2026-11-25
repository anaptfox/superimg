import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareMediaInput, prepareCuts, extractFrames, extractWaveform, exportCuts } from '@foxworth/superimg-node/media-preparation';
import { startConversion, shutdown } from '@foxworth/superimg/runtime';

const dir = await mkdtemp(join(tmpdir(), 'superimg-owned-e2e-'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const path = join(dir, 'input.mp4');
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:size=64x64:rate=4:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=8000:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path], { encoding: 'utf8' });
  assert.equal(ff.status, 0, ff.stderr);
  const bytes = await readFile(path); let fetchCount = 0;
  const fetcher = async () => { fetchCount++; return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 173) c.enqueue(bytes.subarray(i, i + 173)); c.close(); } })); };
  const owned = await prepareMediaInput({ kind: 'url', url: 'https://fixture.invalid/clip' }, { fetch: fetcher });
  try {
    assert.deepEqual(Object.keys(owned).sort(), ['byteLength', 'dispose', 'inspect', 'sha256']);
    assert.equal(owned.sha256, digest(bytes)); assert.equal(owned.byteLength, bytes.length); assert.ok(Object.isFrozen(owned));
    const info = await owned.inspect(); const video = info.tracks.find(t => t.kind === 'video'); const audio = info.tracks.find(t => t.kind === 'audio'); assert.ok(video && audio);
    const frames = await extractFrames(owned, { trackId: video.id, timesSeconds: [0.25], width: 16, height: 16 });
    try { const pixels = await sharp(frames.frames[0].png).raw().toBuffer(); assert.ok(pixels[0] > pixels[2] + 100); assert.equal(frames.sourceSha256, info.sha256); } finally { frames.dispose(); }
    const waveform = await extractWaveform(owned, { trackId: audio.id, bins: 8, startSeconds: 0, endSeconds: 1 });
    assert.ok(waveform.bins.some(b => b.peak > 0.05)); assert.equal(waveform.sourceSha256, info.sha256);
    const abortFrame = new AbortController();
    await assert.rejects(extractFrames(owned, { trackId: video.id, timesSeconds: [0.25, 0.5], width: 16, height: 16, signal: abortFrame.signal, onProgress: () => abortFrame.abort() }));
    await assert.rejects(extractWaveform(owned, { trackId: audio.id, bins: 8, onProgress: () => { throw new Error('public progress failure'); } }), /public progress failure/);
    const plan = await prepareCuts(owned, { source: { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds }, ranges: [{ startSeconds: 0, endSeconds: 0.5 }, { startSeconds: 1, endSeconds: 1.5 }], videoTrackId: video.id, audioTrackId: audio.id, quantization: 'nearest' });
    const cut = await exportCuts(owned, { plan });
    const conversion = await startConversion({ sources: [{ id: 'input', input: { kind: 'bytes', bytes } }], video: { sourceId: 'input', trackId: video.id }, audio: [{ id: 'audio', sourceId: 'input', trackId: audio.id }], format: 'mp4', copy: { mode: 'required' } }).result;
    try {
      await shutdown();
      for (const artifact of [cut.artifact, conversion]) {
        for (let i = 0; i < 2; i++) { const value = new Uint8Array(await new Response(artifact.open()).arrayBuffer()); assert.equal(value.length, artifact.byteLength); assert.equal(digest(value), artifact.sha256); }
        const observed = await prepareMediaInput({ kind: 'bytes', bytes: new Uint8Array(await new Response(artifact.open()).arrayBuffer()) });
        try {
          const facts = await observed.inspect(); const picture = facts.tracks.find(t => t.kind === 'video'); const sound = facts.tracks.find(t => t.kind === 'audio'); assert.ok(picture && sound);
          const outputFrames = await extractFrames(observed, { trackId: picture.id, timesSeconds: [0.25], width: 16, height: 16 });
          try { const rgba = await sharp(outputFrames.frames[0].png).raw().toBuffer(); assert.ok(rgba[0] > rgba[2] + 100); } finally { outputFrames.dispose(); }
          const outputWave = await extractWaveform(observed, { trackId: sound.id, bins: 4, startSeconds: 0, endSeconds: 0.5 });
          assert.ok(outputWave.bins.some(b => b.peak > 0.05));
        } finally { await observed.dispose(); }
        const reader = artifact.open().getReader(); await reader.read(); await artifact.dispose();
        await assert.rejects(reader.read()); reader.releaseLock(); assert.throws(() => artifact.open());
      }
    } finally { await cut.artifact.dispose(); await conversion.dispose(); }
    assert.equal(fetchCount, 1);
  } finally { await owned.dispose(); }
  await assert.rejects(owned.inspect(), /disposed/);
  let cancelled = false, ready;
  const started = new Promise(resolve => { ready = resolve; });
  const abort = new AbortController();
  const pending = prepareMediaInput({ kind: 'url', url: 'https://fixture.invalid/stall' }, { signal: abort.signal, fetch: async () => new Response(new ReadableStream({ pull() { ready(); }, cancel() { cancelled = true; } })) });
  await started; abort.abort(); await assert.rejects(pending); assert.equal(cancelled, true);
  await assert.rejects(prepareMediaInput({ kind: 'bytes', bytes }, { maxInputBytes: bytes.length - 1 }), /byte limit/);
  console.log('owned input public regression passed');
} finally { await shutdown(); await rm(dir, { recursive: true, force: true }); }
