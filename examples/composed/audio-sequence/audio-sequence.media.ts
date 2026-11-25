import { Html, sequence, time, video } from "@foxworth/superimg";

const size = { width: 1280, height: 720 };
const fps = 30;
const mix = { ducking: false };

const WAV_SAMPLE_RATE = 8_000;
const WAV_DURATION_SECONDS = 0.5;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let encoded = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    encoded += BASE64[first >> 2]!;
    encoded += BASE64[((first & 0b11) << 4) | ((second ?? 0) >> 4)]!;
    encoded += second === undefined ? "=" : BASE64[((second & 0b1111) << 2) | ((third ?? 0) >> 6)]!;
    encoded += third === undefined ? "=" : BASE64[third & 0b111111]!;
  }
  return encoded;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

/** A deterministic, nonempty 0.5s mono PCM WAV that works in browser and Node bundles. */
function toneDataUrl(hz: number): string {
  const samples = WAV_SAMPLE_RATE * WAV_DURATION_SECONDS;
  const dataBytes = samples * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  for (let sample = 0; sample < samples; sample += 1) {
    const amplitude = Math.round(Math.sin((2 * Math.PI * hz * sample) / WAV_SAMPLE_RATE) * 0x3fff);
    view.setInt16(44 + sample * 2, amplitude, true);
  }
  return `data:audio/wav;base64,${base64(bytes)}`;
}

const warmTone = toneDataUrl(440);
const coolTone = toneDataUrl(660);

const warm = video({
  size,
  fps,
  duration: "2s",
  audio: { clips: [{ id: "warm-tone", src: warmTone, loop: true }], mix },
  render: () => Html({ width: "fill", height: "fill", html: `<div style="width:100%;height:100%;display:grid;place-items:center;background:#4b2e1f;color:#fff;font:700 88px system-ui">Warm</div>` }),
});

const cool = video({
  size,
  fps,
  duration: "2s",
  audio: { clips: [{ id: "cool-tone", src: coolTone, loop: true }], mix },
  render: () => Html({ width: "fill", height: "fill", html: `<div style="width:100%;height:100%;display:grid;place-items:center;background:#173b5b;color:#fff;font:700 88px system-ui">Cool</div>` }),
});

export default time(sequence([
  { id: "warm", content: warm },
  { id: "cool", content: cool },
]), { size, fps });
