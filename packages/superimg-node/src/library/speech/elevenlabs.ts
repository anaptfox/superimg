import type {
  SpeechProvider,
  SpeechProviderFingerprint,
  SpeechProviderResult,
  SpeechSynthesisRequest,
  SpeechVoice,
} from "./contracts.js";
import {
  SpeechDispatchUncertainError,
  SpeechProviderUnavailableError,
} from "./contracts.js";
import { createWavPcm } from "./wav.js";

export interface ElevenLabsFetch {
  (
    input: string,
    init: Readonly<{
      method: "GET" | "POST";
      headers: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    }>,
  ): Promise<
    Pick<Response, "ok" | "status" | "statusText" | "headers" | "json">
  >;
}
export interface ElevenLabsOptions {
  readonly apiKey: string;
  readonly voiceId: string;
  readonly modelId: string;
  readonly fetch?: ElevenLabsFetch;
  readonly baseUrl?: string;
  readonly output: Readonly<
    { sampleRate: number; channels: number; bitsPerSample: 8 | 16 | 24 | 32 }
  >;
  readonly accountFingerprint: string;
}
export function createElevenLabsProvider(
  options: ElevenLabsOptions,
): SpeechProvider {
  const fetcher = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.elevenlabs.io";
  const fingerprint = (
    request: SpeechSynthesisRequest,
  ): SpeechProviderFingerprint =>
    Object.freeze({
      backend: "elevenlabs",
      details: {
        accountFingerprint: options.accountFingerprint,
        voiceId: options.voiceId,
        modelId: request.model ?? options.modelId,
        output: options.output,
      },
    });
  return Object.freeze({
    id: "elevenlabs",
    version: "1",
    fingerprint,
    async voices(context: { signal?: AbortSignal | undefined } = {}) {
      const signal = context.signal;
      let response: Awaited<ReturnType<ElevenLabsFetch>>;
      try {
        response = await fetcher(
          `${baseUrl.replace(/\/$/, "")}/v1/voices`,
          signal === undefined
            ? {
              method: "GET",
              headers: {
                "xi-api-key": options.apiKey,
                accept: "application/json",
              },
            }
            : {
              method: "GET",
              headers: {
                "xi-api-key": options.apiKey,
                accept: "application/json",
              },
              signal,
            },
        );
      } catch (error) {
        throw new SpeechProviderUnavailableError(
          "ElevenLabs voice catalog request failed",
          { cause: error },
        );
      }
      if (!response.ok) {
        throw new SpeechProviderUnavailableError(
          `ElevenLabs voice catalog failed (${response.status} ${response.statusText})`,
        );
      }
      const payload = await response.json() as { voices?: unknown };
      if (!Array.isArray(payload.voices)) {
        throw new SpeechProviderUnavailableError(
          "ElevenLabs voice catalog response is invalid",
        );
      }
      return Object.freeze(payload.voices.flatMap((voice): SpeechVoice[] => {
        if (voice === null || typeof voice !== "object") return [];
        const raw = voice as {
          voice_id?: unknown;
          name?: unknown;
          labels?: unknown;
          category?: unknown;
        };
        return typeof raw.voice_id === "string" && typeof raw.name === "string"
          ? [
            Object.freeze({
              id: raw.voice_id,
              name: raw.name,
              metadata: jsonObject({
                labels: raw.labels,
                category: raw.category,
              }),
            }),
          ]
          : [];
      }));
    },
    async synthesize(
      request: SpeechSynthesisRequest,
      context: { signal?: AbortSignal | undefined } = {},
    ) {
      const signal = context.signal;
      if (request.voice !== options.voiceId) {
        throw new SpeechProviderUnavailableError(
          `ElevenLabs adapter is configured for voice ${options.voiceId}, not ${request.voice}`,
        );
      }
      assertElevenRequest(request);
      const url = `${baseUrl.replace(/\/$/, "")}/v1/text-to-speech/${
        encodeURIComponent(options.voiceId)
      }/with-timestamps?output_format=pcm_${options.output.sampleRate}`;
      let response: Awaited<ReturnType<ElevenLabsFetch>>;
      try {
        response = await fetcher(
          url,
          signal === undefined
            ? {
              method: "POST",
              headers: {
                "xi-api-key": options.apiKey,
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                text: request.text,
                model_id: request.model ?? options.modelId,
                ...(request.settings === undefined
                  ? {}
                  : { voice_settings: request.settings }),
              }),
            }
            : {
              method: "POST",
              headers: {
                "xi-api-key": options.apiKey,
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                text: request.text,
                model_id: request.model ?? options.modelId,
                ...(request.settings === undefined
                  ? {}
                  : { voice_settings: request.settings }),
              }),
              signal,
            },
        );
      } catch (error) {
        throw new SpeechDispatchUncertainError(
          "ElevenLabs request ended without a confirmed provider response; do not blindly retry",
          { cause: error },
        );
      }
      const requestId = response.headers.get("request-id") ??
        response.headers.get("x-request-id") ?? undefined;
      if (!response.ok) {
        throw new SpeechProviderUnavailableError(
          `ElevenLabs rejected synthesis (${response.status} ${response.statusText})`,
        );
      }
      let payload: {
        audio_base64?: unknown;
        alignment?: unknown;
        normalized_alignment?: unknown;
      };
      try {
        payload = await response.json() as typeof payload;
      } catch (error) {
        throw new SpeechDispatchUncertainError(
          "ElevenLabs accepted the request but returned unreadable timing/audio JSON",
          { cause: error, providerRequestId: requestId },
        );
      }
      if (typeof payload.audio_base64 !== "string") {
        throw new SpeechDispatchUncertainError(
          "ElevenLabs response has no PCM audio payload",
          { providerRequestId: requestId },
        );
      }
      const pcm = decodeBase64(payload.audio_base64, requestId);
      const wav = createWavPcm(pcm, options.output);
      const metadata: Record<string, string | null | object> = {
        providerRequestId: requestId ?? null,
        alignment: jsonValue(payload.alignment),
        normalizedAlignment: jsonValue(payload.normalized_alignment),
      };
      return Object.freeze({
        wav,
        provenance: {
          provider: "elevenlabs",
          adapterVersion: "1",
          backend: fingerprint(request),
          providerMetadata:
            metadata as SpeechProviderResult["provenance"]["providerMetadata"],
        },
      });
    },
  });
}
function jsonValue(value: unknown): string | null | object {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as object;
  } catch {
    return "unserializable-provider-metadata";
  }
}
function jsonObject(
  value: unknown,
): Record<string, import("./contracts.js").SpeechJson> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<
    string,
    import("./contracts.js").SpeechJson
  >;
}
function assertElevenRequest(request: SpeechSynthesisRequest): void {
  if (request.pronunciation !== undefined) {
    throw new Error(
      "ElevenLabs pronunciation data is unsupported until it is represented as documented pronunciation dictionary locators",
    );
  }
  if (request.settings === undefined) return;
  const allowed = new Set([
    "stability",
    "similarity_boost",
    "style",
    "use_speaker_boost",
    "speed",
  ]);
  for (const key of Object.keys(request.settings)) {
    if (!allowed.has(key)) {
      throw new Error(`ElevenLabs does not support setting ${key}`);
    }
  }
}
function decodeBase64(
  value: string,
  requestId: string | undefined,
): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    )
  ) {
    throw new SpeechDispatchUncertainError(
      "ElevenLabs response has malformed PCM base64",
      { providerRequestId: requestId },
    );
  }
  const pcm = Buffer.from(normalized, "base64");
  if (pcm.byteLength === 0) {
    throw new SpeechDispatchUncertainError(
      "ElevenLabs response has empty PCM audio",
      { providerRequestId: requestId },
    );
  }
  return pcm;
}
