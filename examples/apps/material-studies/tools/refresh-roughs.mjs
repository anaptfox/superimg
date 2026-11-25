import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../../..');
const sharp = createRequire(join(root, 'packages/superimg-cli/package.json'))('sharp');
const destination = join(app, 'public/portfolio');
const ids = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(destination, { recursive: true });
const studies = {};
for (const id of ids) {
  const roughDir = join(root, 'output/material-studies/roughs', id);
  const item = { rough: true, fidelityAcceptance: false, poster: null, posters: [], clips: [], films: [] };
  try {
    const files = await readdir(roughDir);
    for (const png of files.filter(name => name.endsWith('.png')).sort()) {
      const prefix = png.split('-')[0];
      const stem = png.slice(0, -4);
      const sourceFile = [`${stem}-source.json`, `${stem}.source.json`, `${stem}.export.json`, `${prefix}-source.json`].find(name => files.includes(name));
      if (!sourceFile) continue;
      const source = JSON.parse(await readFile(join(roughDir, sourceFile), 'utf8'));
      const sourceBytes = await readFile(join(roughDir, png));
      const original = await sharp(sourceBytes).metadata();
      const posterBytes = await sharp(sourceBytes).resize(1280, 720, { fit: 'contain', background: '#101313' }).png().toBuffer();
      const filename = `${id}-${png}`;
      await writeFile(join(destination, filename), posterBytes);
      item.posters.push({ id: png.slice(0, -4), label: png.slice(0, -4).replaceAll('-', ' '), url: `/portfolio/${filename}`, sha256: hash(posterBytes), byteLength: posterBytes.length,
        dimensions: { width: 1280, height: 720 },
        source: { path: join(roughDir, png), sha256: hash(sourceBytes), capturedPixels: { width: original.width, height: original.height }, ...source },
      });
    }
    const preferred = {sandglass:/glass|overview/,cleft:/mineral|overview/,'returning-shore':/coast-4k|underpaint|brush/,'borrowed-shapes':/five-limbs|tree/,'aster-basin':/overview|city/}[id];
    item.poster = [...item.posters].reverse().find(p=>preferred.test(p.id)) ?? item.posters.at(-1) ?? null;
    for (const filename of files.filter(name=>name.endsWith('.mp4')).sort()) {
      const stem=filename.slice(0,-4), sourceFile=files.find(name=>name===`${stem}.export.json`);
      if(!sourceFile)continue;
      const bytes=await readFile(join(roughDir,filename)),source=JSON.parse(await readFile(join(roughDir,sourceFile),'utf8'));
      const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',join(roughDir,filename)],{encoding:'utf8'}));
      const video=metadata.streams.find(s=>s.codec_type==='video'),[numerator,denominator]=video.avg_frame_rate.split('/').map(Number);
      const destinationName=`${id}-${filename}`;await copyFile(join(roughDir,filename),join(destination,destinationName));
      item.clips.push({id:stem,label:stem.replaceAll('-',' '),url:`/portfolio/${destinationName}`,sha256:hash(bytes),byteLength:bytes.length,fps:numerator/denominator,durationSeconds:Number(video.duration??metadata.format.duration),silent:!metadata.streams.some(s=>s.codec_type==='audio'),source:{path:join(roughDir,filename),...source}});
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const reviews = join(root, 'examples/showcase', id, 'output/.superimg/review');
  try {
    const candidates = [];
    for (const folder of await readdir(reviews)) {
      const file = join(reviews, folder, 'report.json');
      try { candidates.push({ file, modified: (await stat(file)).mtimeMs }); } catch { /* An unfinished packet is not an artifact. */ }
    }
    candidates.sort((a, b) => b.modified - a.modified);
    for (const candidate of candidates.reverse()) {
      const report = JSON.parse(await readFile(candidate.file, 'utf8'));
      const revision = report.sourceIdentity.mediaBundleHash.slice(0, 8);
      for (const beat of report.beats ?? []) {
        for (const evidence of beat.evidence ?? []) {
          if (evidence.kind !== 'clip') continue;
          const bytes = await readFile(evidence.path);
          if (hash(bytes) !== evidence.sha256) throw new Error(`Review clip changed: ${evidence.path}`);
          const filename = `${id}-${revision}-${beat.id}.mp4`;
          await copyFile(evidence.path, join(destination, filename));
          item.clips.push({ id: `${revision}-${beat.id}`, label: `${beat.label} · revision ${revision}`, url: `/portfolio/${filename}`, sha256: evidence.sha256,
            byteLength: bytes.length, range: beat.clip?.requestedRange, fps: beat.clip?.fps,
            durationSeconds: beat.clip?.durationSeconds, silent: true,
            source: { path: evidence.path, reportPath: candidate.file, sourceIdentity: report.sourceIdentity, authoredConfig: report.config, selection: report.coordinates, frame: beat.resolved },
          });
        }
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const filmDir = join(root, 'output/material-studies/films', id);
  try {
    for (const filename of (await readdir(filmDir)).filter(name => name.endsWith('.mp4')).sort()) {
      const path = join(filmDir, filename);
      const bytes = await readFile(path);
      const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8' }));
      const video = metadata.streams.find(stream => stream.codec_type === 'video');
      const [numerator, denominator] = video.avg_frame_rate.split('/').map(Number);
      const destinationName = `film-${filename}`;
      await copyFile(path, join(destination, destinationName));
      const acceptancePath = join(root, 'output/material-studies/acceptance', filename.startsWith('tide-ledger') ? 'tide-ledger-manifest.json' : id === 'aster-basin' ? 'aster-basin-manifest.json' : `${id}/${id === 'sandglass' || id === 'returning-shore' ? 'manifest' : 'acceptance'}.json`);
      let acceptance = null;
      try {
        const receiptBytes = await readFile(acceptancePath);
        acceptance = { path: acceptancePath, sha256: hash(receiptBytes), containsFilmSha256: receiptBytes.toString('utf8').includes(hash(bytes)) };
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      item.films.push({ id: filename.slice(0, -4), label: filename.slice(0, -4).replaceAll('-', ' '), url: `/portfolio/${destinationName}`, sha256: hash(bytes), byteLength: bytes.length,
        fps: numerator / denominator, durationSeconds: Number(video.duration ?? metadata.format.duration), dimensions: { width: video.width, height: video.height },
        silent: !metadata.streams.some(stream => stream.codec_type === 'audio'), source: { path, acceptance, scope: 'Encoded film; the linked hashed production manifest records source, native frames, soundtrack, and remaining acceptance limits.' },
      });
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (item.poster || item.clips.length) studies[id] = item;
}
await writeFile(join(destination, 'manifest.json'), JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), rough: true, fidelityAcceptance: false, studies }, null, 2));
console.log(JSON.stringify({ studies: Object.keys(studies), clips: Object.values(studies).reduce((count, item) => count + item.clips.length, 0) }));
