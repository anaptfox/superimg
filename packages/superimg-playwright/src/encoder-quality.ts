import { normalizeEncodingQuality, type EncodingQuality, type HardwareAcceleration } from "@superimg/types";
import type { Quality } from "mediabunny";

type QualityOptions = ConstructorParameters<typeof Quality>[0];

function qualityOptions(value: EncodingQuality | undefined, fallback: QualityOptions): QualityOptions {
  const normalized = normalizeEncodingQuality(value);
  if (normalized === undefined || typeof normalized === "string") return normalized ?? fallback;
  if ("bitrate" in normalized) {
    return { bitrate: normalized.bitrate, ...(normalized.mode !== undefined ? { bitrateMode: normalized.mode } : {}) };
  }
  return { quantizer: normalized.quantizer };
}

/** Shared by native preflight and encoding; importing this policy does not initialize native codecs. */
export function resolveNodeVideoQualityOptions(value?: EncodingQuality, hardwarePreference?: HardwareAcceleration): QualityOptions {
  const options = qualityOptions(value, "high");
  if (hardwarePreference === "prefer-hardware") {
    if (typeof options === "string") return { quality: options, preferBitrate: true };
    if (process.platform === "darwin" && typeof options === "object" && "quantizer" in options) {
      throw new TypeError("VideoToolbox does not support explicit quantizer encoding; choose prefer-software or bitrate quality");
    }
  }
  return options;
}

export function resolveNodeAudioQualityOptions(codec: string, value?: EncodingQuality): QualityOptions {
  return qualityOptions(value, { bitrate: codec === "dts" ? 768_000 : 128_000 });
}
