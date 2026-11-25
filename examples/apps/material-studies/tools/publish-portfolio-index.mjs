import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const output = join(root, 'output/material-studies');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const specs = [
  ['sandglass', 'sandglass', 40],
  ['returning-shore', 'returning-shore', 24],
  ['borrowed-shapes', 'borrowed-shapes', 30],
  ['aster-basin', 'aster-basin', 50],
  ['aster-basin', 'tide-ledger', 18],
  ['cleft', 'cleft-hero', 18],
  ['cleft', 'cleft-sting', 6],
];
const films = specs.flatMap(([study, stem, seconds]) => ['4k', 'teaching-4k'].map(cut => ({study, filename: `${stem}-${cut}.mp4`, width:3840, height:2160, seconds})));
films.push({study:'cleft',filename:'cleft-loop-4k.mp4',width:3840,height:2160,seconds:4}, {study:'cleft',filename:'cleft-loop-square-2160.mp4',width:2160,height:2160,seconds:4});
const artifacts = [];
for (const spec of films) {
  const path = join(output, 'films', spec.study, spec.filename);
  const bytes = await readFile(path);
  const sha256 = hash(bytes);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',path], {encoding:'utf8'}));
  const video = probe.streams.find(s => s.codec_type === 'video');
  const audio = probe.streams.find(s => s.codec_type === 'audio');
  if (video?.width !== spec.width || video?.height !== spec.height || video?.avg_frame_rate !== '30/1' || Number(video?.nb_frames) !== spec.seconds * 30 || Number(video?.duration) !== spec.seconds || Number(audio?.duration) !== spec.seconds || audio?.sample_rate !== '48000' || audio?.channels !== 2 || Number(probe.format.duration) !== spec.seconds) throw new Error(`Delivery contract failed: ${path}`);
  const acceptancePath = join(output, 'acceptance', spec.filename.startsWith('tide-ledger') ? 'tide-ledger-manifest.json' : spec.study === 'aster-basin' ? 'aster-basin-manifest.json' : `${spec.study}/${['sandglass','returning-shore'].includes(spec.study) ? 'manifest' : 'acceptance'}.json`);
  const acceptanceBytes = await readFile(acceptancePath);
  if (!acceptanceBytes.toString('utf8').includes(sha256)) throw new Error(`Production manifest does not bind current film: ${path}`);
  artifacts.push({...spec, path, sha256, byteLength:bytes.length, frames:Number(video.nb_frames), fps:30, audio:{sampleRate:48000,channels:2}, acceptance:{path:acceptancePath,sha256:hash(acceptanceBytes)}});
}
for (const filename of ['cleft-poster-2160.png', 'cleft-icon-64.svg']) {
  const path = join(output,'films/cleft',filename);
  const bytes = await readFile(path);
  const acceptancePath = join(output,'acceptance/cleft/acceptance.json');
  const acceptanceBytes = await readFile(acceptancePath);
  if (!acceptanceBytes.toString('utf8').includes(hash(bytes))) throw new Error(`Static artifact hash is not bound: ${path}`);
  artifacts.push({study:'cleft',filename,path,sha256:hash(bytes),byteLength:bytes.length,acceptance:{path:acceptancePath,sha256:hash(acceptanceBytes)}});
}
const qualificationPath = join(root,'examples/apps/material-studies/public/portfolio/qualification.json');
let qualification = null;
try { const bytes = await readFile(qualificationPath); qualification = {path:qualificationPath,sha256:hash(bytes),modifiedAt:(await stat(qualificationPath)).mtime.toISOString()}; } catch(error) { if(error.code !== 'ENOENT')throw error; }
const index = {schemaVersion:1,createdAt:new Date().toISOString(),kind:'material-studies/portfolio-delivery',status:'Encoded delivery verified. Listening and physical-device acceptance remain unverified.',gallery:'http://127.0.0.1:4193/',artifacts,qualification,verificationScope:'Stream contracts and current production-manifest hash bindings. Native visual, model, cue alignment, loop, source compatibility and export measurements are in each linked manifest.'};
const path = join(output,'portfolio-index.json');
await writeFile(path,JSON.stringify(index,null,2));
console.log(JSON.stringify({path,films:films.length,staticArtifacts:2,qualification:!!qualification}));
