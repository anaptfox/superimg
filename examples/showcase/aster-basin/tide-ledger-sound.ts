/** Offline remapping of the frozen Aster Basin score; never used by render. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { LEDGER_TIME_MAP } from "./tide-ledger.media";

async function main() {
const RATE = 48_000, COUNT = RATE * 18;
const sourceUrl = new URL("./assets/score.wav", import.meta.url);
const source = await readFile(sourceUrl);
if (source.toString("ascii", 0, 4) !== "RIFF" || source.readUInt32LE(24) !== RATE || source.readUInt16LE(22) !== 2 || source.readUInt16LE(34) !== 16) throw new Error("Expected frozen 48kHz stereo PCM16 source");
const interpolate = (seconds: number, channel: number) => {
  const position = Math.max(0, Math.min(RATE * 50 - 1.000001, seconds * RATE));
  const index = Math.floor(position), fraction = position - index;
  const a = source.readInt16LE(44 + index * 4 + channel * 2);
  const b = source.readInt16LE(44 + (index + 1) * 4 + channel * 2);
  return (a + (b - a) * fraction) / 32768;
};
const smooth = (p: number) => { const q = Math.max(0, Math.min(1, p)); return q * q * (3 - 2 * q); };
const samples = new Float64Array(COUNT * 2);
for (let frame = 0; frame < COUNT; frame++) {
  const seconds = frame / RATE;
  const span = LEDGER_TIME_MAP.find(span => seconds < span.end)!;
  const model = span.from + (span.to - span.from) * (seconds - span.start) / (span.end - span.start);
  // 40 ms source segment ramps keep chapter discontinuities from clicking.
  const envelope = span.id === "bed" ? 0 : smooth((seconds - span.start) / .04) * smooth((span.end - seconds) / .04);
  const tail = seconds - 11;
  for (let channel = 0; channel < 2; channel++) {
    const buoy = tail >= 0 && tail < 1.8 ? interpolate(25 + tail, channel) * smooth((1.8 - tail) / .06) : 0;
    samples[frame * 2 + channel] = (interpolate(model, channel) * envelope + buoy) * smooth((18 - seconds) / .18);
  }
}
const peakBeforeGain = samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
const gain = peakBeforeGain > .9 ? .9 / peakBeforeGain : 1;
const wav = Buffer.alloc(44 + COUNT * 4);
source.copy(wav, 0, 0, 44); wav.writeUInt32LE(wav.length - 8, 4); wav.writeUInt32LE(COUNT * 4, 40);
let square = 0;
for (let i = 0; i < samples.length; i++) { const sample = samples[i]! * gain; wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2); square += sample * sample; }
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
await writeFile(new URL("./assets/tide-ledger.wav", import.meta.url), wav);
const manifest = {
  schemaVersion: 1, study: "tide-ledger", durationSeconds: 18, sampleRate: RATE, samplesPerFrame: 1600,
  sampleCount: COUNT, channels: 2, bitDepth: 16, method: "Linear sample remapping of original frozen Atlas score with40ms chapter ramps; original buoy tail layered at arrival",
  source: { path: "score.wav", sha256: hash(source), sourceSamples: RATE * 50 },
  sha256: hash(wav), pcmSha256: hash(wav.subarray(44)), gain, peak: peakBeforeGain * gain, rms: Math.sqrt(square / samples.length),
  modelTimeMap: LEDGER_TIME_MAP,
  cues: [
    { id: "quay-gather", seconds: 1, sample: RATE, sourceSeconds: 2 },
    { id: "port-growth", seconds: 4, sample: RATE * 4, sourceSeconds: 6 },
    { id: "route", seconds: 8, sample: RATE * 8, sourceSeconds: 16 },
    { id: "buoy-arrival", seconds: 11, sample: RATE * 11, sourceSeconds: 25, sourceDuration: 1.8, duration: 1.8, timeScale: 1 },
    { id: "raised-shore", seconds: 11, sample: RATE * 11, sourceSeconds: 30 },
    { id: "open-shore", seconds: 14, sample: RATE * 14, sourceSeconds: 37 + 1 / 30 },
    { id: "erosion", seconds: 16, sample: RATE * 16, sourceSeconds: 42.6 },
  ],
  listening: "unverified",
};
await writeFile(new URL("./assets/tide-ledger.audio.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ wavSha256: manifest.sha256, sourceSha256: manifest.source.sha256, samples: COUNT, peak: manifest.peak }));
}
void main();
