/** Local narration + original, quiet synthetic sound design. No remote service. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { BEATS } from './model.ts';

const directory = fileURLToPath(new URL('./assets/', import.meta.url));
await mkdir(directory, { recursive: true });
const clips: { path: string; at: number; duration: number; voice: string }[] = [];
for (const beat of BEATS) {
  const textFile = join(directory, `${beat.id}.txt`);
  const audioFile = join(directory, `${beat.id}.aiff`);
  await writeFile(textFile, beat.voice);
  execFileSync('say', ['-v', 'Samantha', '-r', '183', '-f', textFile, '-o', audioFile]);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioFile], { encoding: 'utf8' }).trim());
  // Reserve a 2-second silent prediction hold; keep narration clear of cuts.
  const slot = beat.end - beat.start - (beat.id === 'predict' ? 2 : 0.5);
  const pace = Math.max(1, duration / slot);
  const wav = join(directory, `${beat.id}.wav`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', audioFile, '-af', `atempo=${pace},afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, duration / pace - 0.06)}:d=0.06`, '-ar', '48000', '-ac', '1', wav]);
  clips.push({ path: wav, at: beat.start + 0.18, duration: duration / pace, voice: beat.voice });
}
const args: string[] = ['-y', '-loglevel', 'error'];
for (const clip of clips) args.push('-i', clip.path);
const delays = clips.map((clip, i) => `[${i}:a]adelay=${Math.round(clip.at * 1000)}:all=1[v${i}]`).join(';');
const merge = clips.map((_, i) => `[v${i}]`).join('');
args.push('-filter_complex', `${delays};${merge}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:70,loudnorm=I=-17:TP=-1.5:LRA=8[out]`, '-map', '[out]', '-ar', '48000', '-ac', '2', join(directory, 'narration.wav'));
execFileSync('ffmpeg', args);
await writeFile(join(directory, 'narration-timing.json'), JSON.stringify(clips.map(({ path, ...clip }) => clip), null, 2));

// Original sparse score. Harmonic bed and short reveal accents, synthesized
// directly into PCM. This is audio generation, not a substitute video renderer.
const rate = 48000, seconds = 70;
const pcm = Buffer.alloc(seconds * rate * 2);
const accents = [0.25, 5, 15, 23.2, 34.3, 39, 45, 58.3, 62, 65];
for (let i = 0; i < seconds * rate; i++) {
  const t = i / rate;
  const envelope = Math.min(1, t / 2, (seconds - t) / 2);
  const predictionSilence = t > 31.7 && t < 34 ? 0.08 : 1;
  const chord = t >= 34 && t < 58 ? [110, 130.81, 164.81] : [110, 146.83, 220];
  let signal = chord.reduce((sum, hz, n) => sum + Math.sin(2 * Math.PI * hz * t) * (0.011 / (n + 1)), 0) * envelope * predictionSilence;
  for (let j = 0; j < accents.length; j++) {
    const dt = t - accents[j];
    if (dt >= 0 && dt < 0.8) signal += Math.sin(2 * Math.PI * (j === 5 ? 73.42 : 440 + j * 28) * dt) * Math.exp(-dt * 9) * Math.min(1, dt * 100) * 0.09;
  }
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, signal)) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
await writeFile(join(directory, 'score.wav'), Buffer.concat([header, pcm]));
// Freeze compact, portable audio URLs for both Node and browser runtimes.
const audio: Record<string, string> = {};
for (const [name, bitrate] of [['narration', '128k'], ['score', '64k']] as const) {
  const mp3 = join(directory, `${name}.mp3`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(directory, `${name}.wav`), '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3]);
  audio[name] = `data:audio/mpeg;base64,${(await readFile(mp3)).toString('base64')}`;
}
await writeFile(join(directory, 'audio.generated.json'), JSON.stringify(audio));
console.log(JSON.stringify(clips.map(({ path, ...clip }) => clip), null, 2));
