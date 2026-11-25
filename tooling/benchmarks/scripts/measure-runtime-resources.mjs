import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { prepareRuntimeBundle } from './runtime-browser.mjs';
import { exclusiveDirectory } from './run-support.mjs';

// Companion to measure-browser.mjs: immutable source bundles and isolated diagnostics.
const root = resolve(import.meta.dirname, '../../..');
const argument = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const output = argument('--output');
if (!output) throw Error('--output is required and must not exist');
const req = createRequire(join(root, 'package.json'));
const { chromium } = req('playwright');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = resolve(argument('--source') ?? root);
const frozen = argument('--bundle');
const entry = join(root, 'tooling/benchmarks/fixtures/runtime-resources.ts');
if (!frozen) {
  const identity = await prepareRuntimeBundle({ entry, sourceRoot: source, repoRoot: root, output });
  const fonts = [];
  for (const weight of [400, 500, 700]) {
    const bytes = await readFile(join(source, `packages/superimg-core/assets/fonts/Inter-${weight}.ttf`));
    const name = `Inter-${weight}.ttf`;
    await writeFile(join(output, name), bytes);
    fonts.push({ weight, name, sha256: sha(bytes) });
  }
  await writeFile(join(output, 'resources-harness.json'), JSON.stringify({ harnessSha256: sha(await readFile(import.meta.filename)), fonts }));
  if (!process.argv.includes('--prepare-only')) throw Error('Prepare first, then run with --bundle PREPARED_DIRECTORY');
  console.log(JSON.stringify({ prepared: output, inputs: identity.inputs.length }));
  process.exit(0);
}
await exclusiveDirectory(output);
const script = await readFile(join(frozen, 'browser.js'));
const identity = JSON.parse(await readFile(join(frozen, 'identity.json')));
if (sha(script) !== identity.bundleSha256) throw Error('Frozen bundle changed');
const resourceIdentity = JSON.parse(await readFile(join(frozen, 'resources-harness.json')));
if (sha(await readFile(import.meta.filename)) !== resourceIdentity.harnessSha256) throw Error('Resource runner changed; prepare both variants again');
const fonts = new Map();
for (const font of resourceIdentity.fonts) {
  const bytes = await readFile(join(frozen, font.name));
  if (sha(bytes) !== font.sha256) throw Error('Frozen font changed: ' + font.name);
  fonts.set(String(font.weight), bytes);
}
await writeFile(join(output, 'identity.json'), JSON.stringify(identity, null, 2));
await writeFile(join(output, 'resources-harness.json'), JSON.stringify(resourceIdentity, null, 2));
const html = '<!doctype html><meta charset="utf-8"><script type="module" src="/resources.js"></script>';
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url.startsWith('/font/')) {
    response.setHeader('Content-Type', 'font/ttf');
    response.end(fonts.get(request.url.slice(6)));
  } else {
    response.setHeader('Content-Type', request.url === '/resources.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/resources.js' ? script : html);
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 440, height: 763 }, deviceScaleFactor: 3 });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.resourcesReady === true);
  const cdp = await page.context().newCDPSession(page);
  const report = { browser: browser.version(), ffprobe: execFileSync('ffprobe', ['-version'], { encoding: 'utf8' }).split('\n')[0], identity: identity.bundleSha256, time: new Date().toISOString(), fonts: [], exports: [], memory: [], errors };
  const save = () => writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
  if (!process.argv.includes('--memory-only')) {
    if (!process.argv.includes('--export-only')) for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      for (const frames of [60, 600]) for (const withText of [false, true]) {
        const result = await page.evaluate(({ frames, withText }) => window.fontProbe(frames, withText), { frames, withText });
        report.fonts.push({ rate, ...result }); await save();
        console.log(JSON.stringify({ rate, frames, withText, ms: result.samples.reduce((a,b) => a+b, 0) }));
      }
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (!process.argv.includes('--skip-export')) for (const frames of [60, 600]) {
      const result = await page.evaluate(frames => window.fontExport(frames, true), frames);
      const videoPath = join(output, `fonts-${frames}.webm`);
      await writeFile(videoPath, Buffer.from(result.encoded, 'base64'));
      delete result.encoded;
      const decoded = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames:frame=best_effort_timestamp_time', '-of', 'json', videoPath], { encoding: 'utf8' }));
      if (Number(decoded.streams[0].nb_read_frames) !== frames || decoded.streams[0].width !== 160 || decoded.streams[0].height !== 80) throw Error('Decoded frame count or dimensions changed');
      if (decoded.frames.length !== frames) throw Error('Decoded timestamp count changed');
      decoded.frames.forEach((frame, index) => {
        const timestamp = Number(frame.best_effort_timestamp_time);
        if (!Number.isFinite(timestamp) || Math.abs(timestamp - index / 30) > 0.002) throw Error('Decoded frame timestamp changed');
      });
      result.decoded = decoded;
      report.exports.push(result); await save(); console.log(JSON.stringify({ exportFrames: frames, ms: result.exportMs }));
    }
    if (!process.argv.includes('--skip-export')) {
      report.cancellation = await page.evaluate(() => window.fontCancel());
      await save();
    }
  }
  if (!process.argv.includes('--fonts-only') && !process.argv.includes('--export-only')) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      const value = await cdp.send('Runtime.getHeapUsage');
      if (!Number.isFinite(value.backingStorageSize)) throw Error('Browser does not expose backing storage accounting');
      return value;
    };
    const snapshot = async name => {
      const chunks = []; const receive = ({ chunk }) => chunks.push(chunk);
      cdp.on('HeapProfiler.addHeapSnapshotChunk', receive);
      await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      cdp.off('HeapProfiler.addHeapSnapshotChunk', receive);
      await writeFile(join(output, name + '.heapsnapshot'), chunks.join(''));
    };
    for (const [count, mib, retainRead] of [[1, 4, false], [8, 4, false], [4, 16, false], [1, 4, true]]) {
      const before = await heap();
      await page.evaluate(({ count, mib, retainRead }) => window.memoryAllocate(count, mib * 1024 * 1024, retainRead), { count, mib, retainRead });
      const adopted = await heap();
      if (process.argv.includes('--heap-snapshots') && count === 8) await snapshot('adopted');
      await page.evaluate(() => window.memoryDispose());
      const disposed = await heap();
      if (process.argv.includes('--heap-snapshots') && count === 8) await snapshot('disposed-retained');
      await page.evaluate(() => window.memoryClear());
      const cleared = await heap();
      if (process.argv.includes('--heap-snapshots') && count === 8) await snapshot('history-cleared');
      report.memory.push({ count, mib, retainRead, before, adopted, disposed, cleared }); await save();
      console.log(JSON.stringify({ count, mib, retainRead, adopted: adopted.backingStorageSize - before.backingStorageSize, disposed: disposed.backingStorageSize - before.backingStorageSize }));
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  await save();
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
