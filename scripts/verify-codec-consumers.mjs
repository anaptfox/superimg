// Run after building both public packages. Every installation and fixture is task-owned.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--evidence-dir')) throw new Error('Usage: node scripts/verify-codec-consumers.mjs [--evidence-dir NEW_DIRECTORY]');
const evidence = args.length ? resolve(args[1]) : undefined;
if (evidence) mkdirSync(evidence); // Never overwrite a previous acceptance attempt.
const temp = mkdtempSync(join(tmpdir(), 'superimg-codec-consumers-'));
const packs = join(temp, 'packs');
const combined = join(temp, 'combined');
const rootOnly = join(temp, 'root-only');
const fixtureDir = join(repo, 'tests/integration/fixtures');
const env = { ...process.env, NODE_PATH: '', NODE_OPTIONS: '', npm_config_ignore_scripts: 'false' };
const record = { status: 'failed', node: process.version, platform: process.platform, arch: process.arch, commands: [], tarballs: [] };
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
let sequence = 0;
function run(command, argv, cwd, extraEnv = {}) {
  const index = String(++sequence).padStart(2, '0');
  const result = spawnSync(command, argv, { cwd, env: { ...env, ...extraEnv }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (evidence) {
    writeFileSync(join(evidence, `${index}-stdout.log`), result.stdout ?? '');
    writeFileSync(join(evidence, `${index}-stderr.log`), result.stderr ?? '');
  }
  record.commands.push({ command, args: argv, cwd, status: result.status, signal: result.signal, error: result.error?.message });
  if (result.status !== 0) throw new Error(`Failed: ${command} ${argv.join(' ')} (in ${cwd}): ${result.error?.message ?? `exit ${result.status}`}`);
  return result.stdout;
}
function ffmpeg(argv) { run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], combined); }
try {
  console.log('Prerequisites: built public dist, pnpm, registry access, native install scripts, Chromium, and ffmpeg with libx264, prores_ks, AAC and experimental dca encoders.');
  run('pnpm', ['--version'], repo);
  run('ffmpeg', ['-version'], repo);
  run('git', ['status', '--short'], repo);
  run('git', ['rev-parse', 'HEAD'], repo);
  run('df', ['-h', temp], repo);
  for (const path of [packs, combined, rootOnly]) mkdirSync(path, { recursive: true });
  for (const folder of ['superimg', 'superimg-node-public']) run('pnpm', ['pack', '--pack-destination', packs], join(repo, 'packages', folder));
  const archives = readdirSync(packs);
  const rootPack = archives.find(name => /^foxworth-superimg-/.test(name) && !/^foxworth-superimg-node-/.test(name) && name.endsWith('.tgz'));
  const nodePack = archives.find(name => /^foxworth-superimg-node-/.test(name) && name.endsWith('.tgz'));
  if (!rootPack || !nodePack || archives.filter(name => name.endsWith('.tgz')).length !== 2) throw new Error('Expected exactly one packed root and one packed Node package.');
  for (const name of [rootPack, nodePack]) {
    const path = join(packs, name);
    record.tarballs.push({ name, sha256: digest(path) });
    if (evidence) copyFileSync(path, join(evidence, name));
    run('tar', ['-tzf', path], repo);
    const manifest = JSON.parse(run('tar', ['-xOzf', path, 'package/package.json'], repo));
    if (JSON.stringify(manifest).match(/(?:workspace:|catalog:)/)) throw new Error(`Unresolved protocol in ${name}`);
    if (evidence) writeFileSync(join(evidence, `${name}.manifest.json`), JSON.stringify(manifest, null, 2));
  }
  for (const dir of [combined, rootOnly]) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'codec-consumer', version: '1.0.0', private: true, type: 'module' }));
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\nautoInstallPeers: false\nallowBuilds:\n  node-av: true\n  sharp: true\n');
  }
  const install = (dir, deps) => run('pnpm', ['add', '--config.auto-install-peers=false', ...deps], dir);
  install(rootOnly, [join(packs, rootPack)]);
  copyFileSync(join(fixtureDir, 'codec-consumer/root-only.mjs'), join(rootOnly, 'root-only.mjs'));
  run(process.execPath, ['root-only.mjs'], rootOnly);
  if (evidence) for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) copyFileSync(join(rootOnly, name), join(evidence, `root-only-${name}`));
  rmSync(rootOnly, { recursive: true, force: true });
  install(combined, [join(packs, rootPack), join(packs, nodePack), 'mediabunny@1.66.2', '@mediabunny/server@1.66.2', '@mediabunny/dts@1.66.2', 'node-av@6.2.0', 'playwright@1.65.0']);
  const typescript = JSON.parse(readFileSync(join(repo, 'node_modules/typescript/package.json'), 'utf8')).version;
  const nodeTypes = JSON.parse(readFileSync(join(repo, 'node_modules/@types/node/package.json'), 'utf8')).version;
  run('pnpm', ['add', '-D', '--config.auto-install-peers=false', `typescript@${typescript}`, `@types/node@${nodeTypes}`], combined);
  const graph = JSON.parse(run('pnpm', ['list', '--json', '--depth', 'Infinity'], combined));
  function auditDependencies(node) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) for (const [name, dependency] of Object.entries(node[field] ?? {})) {
      if (name.startsWith('@superimg/') || name === '@foxworth/superimg-cli' || name.toLowerCase().includes('boundary')) throw new Error(`Forbidden installed dependency: ${name}`);
      auditDependencies(dependency);
    }
  }
  for (const node of graph) auditDependencies(node);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--version'], combined);
  for (const file of ['final-library-consumer.mjs', 'final-library-consumer.ts']) copyFileSync(join(fixtureDir, file), join(combined, file));
  writeFileSync(join(combined, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: false, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', types: ['node'] }, files: ['final-library-consumer.ts'] }, null, 2));
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], combined);
  const raw = Buffer.alloc(32 * 32 * 4 * 2);
  for (let i = 0; i < raw.length; i += 4) { raw[i] = 240; raw[i + 3] = 100; }
  writeFileSync(join(combined, 'opaque.rgba'), Buffer.from(raw.map((byte, i) => i % 4 === 3 ? 255 : byte)));
  writeFileSync(join(combined, 'alpha.rgba'), raw);
  const rawInput = file => ['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', '32x32', '-framerate', '2', '-i', file];
  ffmpeg([...rawInput('opaque.rgba'), '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'avc-aac.mp4']);
  ffmpeg([...rawInput('opaque.rgba'), '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', 'opaque.mov']);
  ffmpeg([...rawInput('alpha.rgba'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', 'alpha.mov']);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-strict', '-2', '-c:a', 'dca', 'dts.mka']);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=32x32:r=4:d=1', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32:r=4:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=8000:duration=2', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'final-input.mp4']);
  record.fixtures = Object.fromEntries(['avc-aac.mp4', 'opaque.mov', 'alpha.mov', 'dts.mka', 'final-input.mp4'].map(file => [file, digest(join(combined, file))]));
  run('pnpm', ['exec', 'vitest', 'run', 'src/codec-consumer.e2e.test.ts'], join(repo, 'tests/integration'), { SUPERIMG_CODEC_CONSUMER_DIR: combined });
  run(process.execPath, ['final-library-consumer.mjs'], combined);
  record.status = 'passed';
  console.log('Packed codec and final public-library consumers passed.');
} finally {
  try {
    if (evidence) {
      for (const [label, dir] of [['root-only', rootOnly], ['combined', combined]]) {
        for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'final-library-facts.json', 'codec-root-first-facts.json', 'codec-node-first-facts.json']) {
          const source = join(dir, name);
          if (existsSync(source)) copyFileSync(source, join(evidence, `${label}-${name}`));
        }
      }
      writeFileSync(join(evidence, 'report.json'), JSON.stringify(record, null, 2));
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
