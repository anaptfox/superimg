#!/usr/bin/env node
// Source-linked resource diagnostics; never treats package dist as current source.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { rolldown } from 'rolldown';
import { chromium } from 'playwright';
import { prepareRuntimeBundle } from './runtime-browser.mjs';
import { exclusiveDirectory } from './run-support.mjs';
const root = resolve(import.meta.dirname, '../../..');
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const output = option('--output');
if (!output) throw Error('--output NEW_DIRECTORY required');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entry = join(root, 'tooling/benchmarks/fixtures/review-loading-dx.ts');
if (process.argv.includes('--graph')) {
  await exclusiveDirectory(output);
  const reports = [];
  const graphSource = await realpath(resolve(option('--source') ?? root));
  for (const [name, source] of [
    ['passive-player', `import { createDomPlayer } from '@superimg/player/dom'; globalThis.fixture = createDomPlayer;`],
    ['browser-document-runtime', `import { render } from '../../../packages/superimg/src/runtime.browser.ts'; globalThis.fixture = render;`],
  ]) {
    const bundle = await rolldown({ input: 'review-virtual-entry', platform: 'browser',
      onwarn(warning, defaultHandler) {
        if (warning.code === 'UNRESOLVED_IMPORT' || warning.code === 'MISSING_GLOBAL_NAME') throw Error(warning.message);
        defaultHandler(warning);
      }, plugins: [{
      name: 'source-review',
      async resolveId(id, importer) {
        if (id === 'review-virtual-entry') return id;
        if (id.startsWith('../../../packages/')) return resolve(graphSource, id.slice(9));
        if (!id.startsWith('@superimg/')) {
          if (graphSource !== root && importer?.startsWith(graphSource + '/') && !id.startsWith('.') && !id.startsWith('/')) {
            return this.resolve(id, root + importer.slice(graphSource.length), { skipSelf: true });
          }
          return null;
        }
        if (id === '@superimg/player/dom') return join(graphSource, 'packages/superimg-player/src/index.dom.ts');
        if (id === '@superimg/core/edge') return join(graphSource, 'packages/superimg-core/src/index.edge.ts');
        const [, name, ...parts] = id.split('/');
        const base = join(graphSource, `packages/superimg-${name}/src`, parts.join('/') || 'index');
        for (const p of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) if (existsSync(p)) return p;
        throw Error('No source entry ' + id);
      }, load(id) { return id === 'review-virtual-entry' ? source : null; },
    }] });
    try {
      const generated = await bundle.generate({ format: 'es', minify: true, codeSplitting: true });
      const chunks = new Map(generated.output.filter(x => x.type === 'chunk').map(x => [x.fileName, x]));
      const eager = new Set();
      function visit(c) { if (eager.has(c)) return; eager.add(c); for (const id of c.imports) if (chunks.has(id)) visit(chunks.get(id)); }
      visit([...chunks.values()].find(c => c.isEntry));
      const modules = [...new Set([...eager].flatMap(c => Object.keys(c.modules)))];
      const inputs = await Promise.all(modules.filter(p => existsSync(p)).sort().map(async path => ({ path, sha256: sha(await readFile(path)) })));
      for (const chunk of chunks.values()) {
        const path = join(output, name, chunk.fileName);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, chunk.code);
      }
      reports.push({ name, provenance: 'generated artifact sizes; source inventory hashed after compilation, not a source-stability proof', eagerGzipBytes: [...eager].reduce((n,c) => n + gzipSync(c.code, { level: 9 }).length, 0), eagerChunks: [...eager].map(c => c.fileName), modules, inputs, allChunks: [...chunks.values()].map(c => ({ name: c.fileName, sha256: sha(c.code), gzipBytes: gzipSync(c.code, { level: 9 }).length })) });
    } finally { await bundle.close(); }
  }
  await writeFile(join(output, 'graphs.json'), JSON.stringify({ node: process.version, sourceRoot: graphSource, mode: 'source-linked minified ESM, gzip level 9; artifact graph only, no browser execution', reports }, null, 2));
  console.log(JSON.stringify(reports.map(({ name, eagerGzipBytes, modules }) => ({ name, eagerGzipBytes, modules: modules.length }))));
} else if (process.argv.includes('--prepare')) {
  await prepareRuntimeBundle({ entry, sourceRoot: resolve(option('--source') ?? root), repoRoot: root, output });
  await writeFile(join(output, 'runner.sha256'), sha(await readFile(import.meta.filename)));
  console.log(JSON.stringify({ prepared: output }));
} else if (process.argv.includes('--dx')) {
  // Explicitly opt in: serial shared builds must be coordinated with other agents.
  await exclusiveDirectory(output);
  const media = option('--media');
  if (!media) throw Error('--dx requires --media existing.media.ts');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(p => p && (/^(packages|tooling)\//.test(p) || ['pnpm-lock.yaml', 'package.json', 'Justfile', 'turbo.json'].includes(p)));
  const fingerprint = async () => {
    const files = await Promise.all(tracked.map(async path => [path, sha(await readFile(join(root, path)).catch(error => error.code === 'ENOENT' ? Buffer.from('missing') : Promise.reject(error)))]));
    return sha(JSON.stringify(files));
  };
  const sourceBefore = await fingerprint();
  const mediaSha = sha(await readFile(resolve(root, media)));
  const runnerSha = sha(await readFile(import.meta.filename));
  const results = [];
  for (const args of [['build-render'], ['cli', 'check', media], ['cli', 'inspect', media, '--pretty']]) {
    const started = performance.now();
    const child = spawn('just', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    child.stdout.on('data', b => stdout.push(b)); child.stderr.on('data', b => stderr.push(b));
    const code = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
    results.push({ command: ['just', ...args], ms: performance.now() - started, code });
    await writeFile(join(output, `command-${results.length}.stdout`), Buffer.concat(stdout));
    await writeFile(join(output, `command-${results.length}.stderr`), Buffer.concat(stderr));
    await writeFile(join(output, 'results.json'), JSON.stringify({ node: process.version, sourceBefore, sourceAfter: await fingerprint(), media: { path: media, before: mediaSha, after: sha(await readFile(resolve(root, media))) }, runnerSha, runnerConfig: { path: process.env.PATH, verifyDepsBeforeRun: process.env.pnpm_config_verify_deps_before_run ?? 'default' }, timing: 'serial whole-command wall clock including command runner and build orchestration; not compiler-only', results }, null, 2));
    if (code !== 0) throw Error('DX command failed; see retained output');
    if (sha(await readFile(resolve(root, media))) !== mediaSha || sha(await readFile(import.meta.filename)) !== runnerSha) throw Error('Media/runner changed during DX timing');
    if (await fingerprint() !== sourceBefore) throw Error('Tracked sources changed during DX timing; inspect identities before accepting');
  }
} else {
  const frozen = option('--bundle');
  if (!frozen) throw Error('Use --prepare, then --bundle PREPARED_DIRECTORY');
  await exclusiveDirectory(output);
  const identity = JSON.parse(await readFile(join(frozen, 'identity.json')));
  const runnerSha = sha(await readFile(import.meta.filename));
  const lockSha = sha(await readFile(join(root, 'pnpm-lock.yaml')));
  if (lockSha !== identity.lockfileSha256) throw Error('Lockfile changed');
  const bytes = await readFile(join(frozen, 'browser.js'));
  if (sha(bytes) !== identity.bundleSha256 || sha(await readFile(import.meta.filename)) !== (await readFile(join(frozen, 'runner.sha256'), 'utf8'))) throw Error('Prepared bundle/runner changed');
  for (const input of identity.inputs) if (sha(await readFile(input.path)) !== input.sha256) throw Error(`Source changed since preparation: ${input.path}`);
  const server = createServer((req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', req.url === '/bench.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/bench.js' ? bytes : '<script src="/bench.js"></script>'); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  let browser;
  try {
    if (process.env.SUPERIMG_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.SUPERIMG_BROWSERS_PATH;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof globalThis.reviewLoadingDx === 'function');
    if (process.argv.includes('--no-native-base64')) {
      await page.evaluate(() => Object.defineProperty(Uint8Array.prototype, 'toBase64', { configurable: true, value: undefined }));
    }
    const nativeBase64 = await page.evaluate(() => typeof Uint8Array.prototype.toBase64 === 'function');
    const cdp = await page.context().newCDPSession(page);
    const runs = [];
    for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      runs.push({ rate, results: await page.evaluate(() => globalThis.reviewLoadingDx([1024, 65536, 1048576, 4194304])) });
    }
    if (errors.length) throw Error(errors.join('\n'));
    for (const input of identity.inputs) if (sha(await readFile(input.path)) !== input.sha256) throw Error(`Source changed during run: ${input.path}`);
    if (sha(await readFile(import.meta.filename)) !== runnerSha || sha(await readFile(join(root, 'pnpm-lock.yaml'))) !== lockSha) throw Error('Runner/lockfile changed during run');
    await writeFile(join(output, 'results.json'), JSON.stringify({ identity, runnerSha, lockSha, nativeBase64, protocol: { version: 2, preparationMs: 'prepareRuntimeResources plus assetUrls and fontCss materialization', freezeOnlyMs: 'prepareRuntimeResources return; eager baseline also serializes before return', materializationMs: 'projection getter access after return' }, browser: browser.version(), node: process.version, cpu: os.cpus()[0]?.model, conditions: 'one browser process; local no-store; synthetic byte assets; one warm-up + five samples per size/rate; input allocation and correctness outside timers; resource/result/read allocations inside their respective timed operations', runs, errors, sourceUnchanged: true }, null, 2));
    console.log(JSON.stringify({ complete: output }));
  } finally { await browser?.close(); await new Promise(done => server.close(done)); }
}
