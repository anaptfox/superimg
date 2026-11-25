import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { extractFrames, prepareMediaInput } from '@foxworth/superimg-node/media-preparation';

const dir = await mkdtemp(join(tmpdir(), 'superimg-frame-'));
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg failed: ${result.error}`);
}
async function run(name, codec, pixFmt, alpha, filters = 'null', geometry = '') {
  const raw = Buffer.alloc(32 * 32 * 4 * 2);
  for (let frame = 0; frame < 2; frame++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = ((frame * 32 + y) * 32 + x) * 4;
    const red = (x < 16) !== (frame === 1);
    raw[i] = red ? 240 : 0; raw[i + 2] = red ? 0 : 240; raw[i + 3] = alpha ? (x < 16 ? 80 : 210) : 255;
  }
  const rawPath = join(dir, `${name}.rgba`), path = join(dir, `${name}.mov`);
  await writeFile(rawPath, raw);
  ffmpeg(['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', '32x32', '-framerate', '2', '-i', rawPath, '-vf', filters, '-c:v', codec, '-pix_fmt', pixFmt, ...(codec === 'prores_ks' ? ['-profile:v', alpha ? '4444' : '3'] : []), path]);
  const bytes = await readFile(path);
  if (geometry) {
    const tkhd = bytes.indexOf('tkhd'); assert.ok(tkhd > 0); assert.equal(bytes[tkhd + 4], 0);
    const matrix = geometry === 'rotate' ? [0, 65536, 0, -65536, 0, 0, 32 * 65536, 0, 1073741824] : [-65536, 0, 0, 0, 65536, 0, 32 * 65536, 0, 1073741824];
    matrix.forEach((value, i) => bytes.writeInt32BE(value, tkhd + 44 + i * 4));
  }
  const source = await prepareMediaInput({ kind: 'bytes', bytes });
  try {
    const track = (await source.inspect()).tracks.find(track => track.kind === 'video'); assert.ok(track);
    if (geometry === 'rotate') assert.equal(track.rotation, 90);
    if (geometry === 'flip') assert.equal(track.flip, true);
    if (filters.includes('setsar')) assert.notEqual(track.displayWidth, track.width);
    const width = name === 'prores-odd' ? 25 : 24, height = name === 'prores-odd' ? 19 : 18;
    const result = await extractFrames(source, { trackId: track.id, timesSeconds: [0.6, 0.1, 0.6], width, height });
    try {
      assert.deepEqual(result.frames.map(f => f.requestedSeconds), [0.6, 0.1, 0.6]);
      assert.deepEqual(result.frames.map(f => f.timestampSeconds), [0.5, 0, 0.5]);
      for (const [index, frame] of result.frames.entries()) {
        const { data, info } = await sharp(frame.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, width); assert.equal(info.height, height);
        const at = (x, y) => [...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
        const a = at(geometry === 'rotate' ? 12 : 4, geometry === 'rotate' ? 3 : 9), b = at(geometry === 'rotate' ? 12 : 19, geometry === 'rotate' ? 14 : 9);
        // The matrix rotates source left to top; a flip moves source right to left.
        // Frames 0 and 1 swap red and blue, so every requested picture is checked.
        const aIsRed = (index === 1) !== (geometry === 'flip');
        assert.ok(aIsRed ? a[0] - a[2] > 100 : a[2] - a[0] > 100, `${name} frame ${index}: ${a}`);
        assert.ok(aIsRed ? b[2] - b[0] > 100 : b[0] - b[2] > 100, `${name} frame ${index}: ${b}`);
        if (alpha) assert.ok(a[3] < 120 && b[3] > 170, `${name} alpha frame ${index}: ${a} ${b}`);
        else assert.equal(a[3], 255);
        console.log(name, { index, pixels: [a, b], size: [info.width, info.height], rotation: track.rotation, display: [track.displayWidth, track.displayHeight] });
      }
    } finally { result.dispose(); }
  } finally { await source.dispose(); }
}
try {
  await run('avc', 'libx264', 'yuv420p', false);
  await run('prores', 'prores_ks', 'yuv422p10le', false);
  await run('prores-odd', 'prores_ks', 'yuv422p10le', false);
  await run('prores-alpha', 'prores_ks', 'yuva444p10le', true);
  await run('rotated', 'libx264', 'yuv420p', false, 'null', 'rotate');
  await run('flipped', 'libx264', 'yuv420p', false, 'null', 'flip');
  await run('nonsquare', 'libx264', 'yuv420p', false, 'setsar=2/1');
} finally { await rm(dir, { recursive: true, force: true }); }
