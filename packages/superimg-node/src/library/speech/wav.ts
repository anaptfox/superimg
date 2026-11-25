import { createHash } from "node:crypto";
import type { WavPcmMetadata } from "./contracts.js";

export function validateWavPcm(input: Uint8Array): WavPcmMetadata {
  if (
    input.byteLength < 44 || ascii(input, 0, 4) !== "RIFF" ||
    ascii(input, 8, 4) !== "WAVE"
  ) {
    throw new Error("Speech output is not a RIFF/WAVE file");
  }
  const declared = readU32(input, 4);
  if (declared + 8 > input.byteLength) {
    throw new Error("Speech WAV RIFF length is truncated");
  }
  let offset = 12;
  let format: {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bits: number;
  } | undefined;
  let data: { offset: number; size: number } | undefined;
  while (offset + 8 <= input.byteLength) {
    const id = ascii(input, offset, 4);
    const size = readU32(input, offset + 4);
    const body = offset + 8;
    if (body + size > input.byteLength) {
      throw new Error(`Speech WAV ${id} chunk is truncated`);
    }
    if (id === "fmt ") {
      if (size < 16) throw new Error("Speech WAV fmt chunk is too short");
      format = {
        audioFormat: readU16(input, body),
        channels: readU16(input, body + 2),
        sampleRate: readU32(input, body + 4),
        byteRate: readU32(input, body + 8),
        blockAlign: readU16(input, body + 12),
        bits: readU16(input, body + 14),
      };
    } else if (id === "data" && data === undefined) {
      data = { offset: body, size };
    }
    offset = body + size + (size % 2);
  }
  if (format === undefined || data === undefined) {
    throw new Error("Speech WAV requires fmt and data chunks");
  }
  if (format.audioFormat !== 1) {
    throw new Error(
      `Speech WAV must be PCM (got format ${format.audioFormat})`,
    );
  }
  if (
    !Number.isInteger(format.channels) || format.channels < 1 ||
    format.channels > 32 || !Number.isInteger(format.sampleRate) ||
    format.sampleRate < 1
  ) throw new Error("Speech WAV has invalid channel or sample rate metadata");
  if (![8, 16, 24, 32].includes(format.bits)) {
    throw new Error(`Speech WAV has unsupported PCM bit depth ${format.bits}`);
  }
  const expectedAlign = format.channels * (format.bits / 8);
  if (
    format.blockAlign !== expectedAlign ||
    format.byteRate !== format.sampleRate * expectedAlign ||
    data.size % expectedAlign !== 0
  ) throw new Error("Speech WAV PCM metadata does not match its data chunk");
  return Object.freeze({
    container: "wav",
    audioFormat: 1,
    sampleRate: format.sampleRate,
    channels: format.channels,
    bitsPerSample: format.bits as 8 | 16 | 24 | 32,
    sampleFrames: data.size / expectedAlign,
    byteLength: input.byteLength,
    durationSeconds: data.size / (format.sampleRate * expectedAlign),
  });
}

export function createWavPcm(
  pcm: Uint8Array,
  options: Readonly<
    { sampleRate: number; channels: number; bitsPerSample: 8 | 16 | 24 | 32 }
  >,
): Uint8Array {
  const align = options.channels * (options.bitsPerSample / 8);
  if (
    !Number.isInteger(options.sampleRate) || options.sampleRate < 1 ||
    !Number.isInteger(options.channels) || options.channels < 1 ||
    pcm.byteLength === 0 || pcm.byteLength % align !== 0
  ) throw new Error("Cannot create WAV from invalid PCM metadata");
  const bytes = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(bytes, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, options.channels, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * align, true);
  view.setUint16(32, align, true);
  view.setUint16(34, options.bitsPerSample, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  bytes.set(pcm, 44);
  return bytes;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function ascii(bytes: Uint8Array, start: number, size: number): string {
  return Buffer.from(bytes.subarray(start, start + size)).toString("ascii");
}
function writeAscii(bytes: Uint8Array, start: number, value: string): void {
  bytes.set(Buffer.from(value, "ascii"), start);
}
function readU16(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .getUint16(at, true);
}
function readU32(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .getUint32(at, true);
}
