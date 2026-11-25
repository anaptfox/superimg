import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialSourceHashes as sourceHashesForRoot } from './source-hashes.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../../..');
const args = process.argv.slice(2);
const value = (flag, fallback) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
const studies = value('--study', 'sandglass').split(',');
const profiles = value('--profile', 'full').split(',');
const url = value('--url', 'http://127.0.0.1:4193/');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Benchmark the local gallery only');
if (studies.some(id => !['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'].includes(id))) throw new Error('Unknown study');
if (profiles.some(profile => !['full', 'reduced'].includes(profile))) throw new Error('Unknown profile');
const output = resolve(value('--output', join(app, 'output/benchmarks')));
const isolated = args.includes('--isolated');
const diagnostic = args.includes('--diagnostic');
const backgroundNote = value('--background-note', null);
await mkdir(output, { recursive: true });
const sourceHashes = id => sourceHashesForRoot(root, id);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  let activeCase = 'loading';
  await page.exposeFunction('materialBenchmarkProgress', message => console.log(`${new Date().toISOString()} ${activeCase} ${message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.materialStudies?.state()?.accepted);
  for (const study of studies) {
    for (const fidelity of profiles) {
      activeCase = `${study}/${fidelity}`;
      await page.evaluate(study => window.materialStudies.select(study), study);
      if (!await page.evaluate(() => !!window.materialStudies.state())) throw new Error(`${study} is not ready`);
      await page.evaluate(fidelity => window.materialStudies.update({ fidelity }), fidelity);
      const before = await sourceHashes(study);
      const attempt = { schemaVersion: 1, kind: 'material-studies/benchmark-attempt', study, fidelity,
        diagnostic, measured: false, defaultQualified: false, startedAt: new Date().toISOString(), sourceFiles: before };
      await writeFile(join(output, `${study}-${fidelity}-attempt.json`), JSON.stringify(attempt, null, 2));
      console.log(`${study} ${fidelity}: ${diagnostic ? 'diagnostic: one five-second run per scenario after two seconds of warm-up' : 'three 60-second runs per scenario, each after ten seconds of warm-up'}`);
      let result;
      try {
        result = await page.evaluate(({ isolated, diagnostic }) => window.materialStudies.benchmark({ isolated,
          ...(diagnostic ? { repetitions: 1, warmupMs: 2_000, durationMs: 5_000 } : {}),
          onProgress: message => window.materialBenchmarkProgress(message) }), { isolated, diagnostic });
      } catch (error) {
        await writeFile(join(output, `${study}-${fidelity}-interrupted-${Date.now()}.json`), JSON.stringify({ ...attempt,
          kind: 'material-studies/benchmark-interrupted', endedAt: new Date().toISOString(), error: String(error),
          scope: 'The interrupted call did not publish a completed run or qualification.' }, null, 2));
        throw error;
      }
      const after = await sourceHashes(study);
      const sourceStable = JSON.stringify(before) === JSON.stringify(after);
      const record = { ...result, defaultQualified: result.defaultQualified && sourceStable, measurementContext: { headless: true, physicalDeviceAcceptance: false, platform: platform(), osRelease: release(), cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), backgroundActivity: backgroundNote ?? (isolated ? 'Operator confirmed exports and other rendering loads finished before measurement.' : 'Isolation unverified; record concurrent exports or other heavy work separately.') }, sourceFiles: before, sourceStable };
      const destination = join(output, `${study}-${fidelity}.json`);
      await writeFile(destination, JSON.stringify(record, null, 2));
      console.log(JSON.stringify({ study, fidelity, sourceStable, measured: result.measured, meetsLiveBudget: result.meetsLiveBudget, heldScenesIdle: result.heldScenesIdle,
        scenarios: result.runs.map(run => ({ mode: run.mode, p95Ms: run.inputLatencyMs.p95, acceptedPerSecond: run.accepted / (run.durationMs / 1000), failures: run.failures, coalesced: run.coalesced })), path: destination }));
    }
  }
} finally { await browser.close(); }
