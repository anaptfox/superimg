import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQualification } from '../src/qualification.ts';
import { MATERIAL_STUDY_IDS, materialSourceDigest, materialSourceDigests } from './source-hashes.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../../..');
const args = process.argv.slice(2);
const value = (flag, fallback) => { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1]; };
const input = resolve(value('--reports', join(root, 'output/material-studies/benchmarks')));
const inputs = [];
for (const id of MATERIAL_STUDY_IDS) for (const fidelity of ['full', 'reduced']) {
  const path = join(input, `${id}-${fidelity}.json`);
  const record = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(record.sourceFiles) || record.sourceFiles.length === 0) throw new Error(`${path}: source hash inventory is missing`);
  inputs.push({ report: path.slice(root.length + 1), sourceDigest: materialSourceDigest(record.sourceFiles), record });
}
const qualification = buildQualification(inputs, await materialSourceDigests(root));
const destination = join(app, 'public/portfolio/qualification.json');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(qualification, null, 2) + '\n');
await writeFile(join(input, 'qualification.json'), JSON.stringify(qualification, null, 2) + '\n');
console.log(JSON.stringify({ destination, choices: Object.fromEntries(Object.entries(qualification.studies).map(([id, entry]) => [id, entry.defaultFidelity])) }));
