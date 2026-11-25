/** Node-only speech synthesis contracts. A rendered media program references the frozen result, never a provider. */
export type SpeechJson =
  | null
  | boolean
  | number
  | string
  | readonly SpeechJson[]
  | { readonly [key: string]: SpeechJson };

export interface SpeechSynthesisRequest {
  readonly text: string;
  readonly voice: string;
  readonly model?: string;
  /** Provider-specific controls. Every value participates in the cache key. */
  readonly settings?: Readonly<Record<string, SpeechJson>>;
  /** Pronunciation/context material. It participates in the cache key. */
  readonly pronunciation?: Readonly<Record<string, SpeechJson>>;
}

export interface SpeechProviderFingerprint {
  readonly backend: string;
  readonly details: Readonly<Record<string, SpeechJson>>;
}

export interface SpeechVoice {
  readonly id: string;
  readonly name: string;
  readonly locale?: string;
  readonly metadata?: Readonly<Record<string, SpeechJson>>;
}

export interface SpeechProviderProvenance {
  readonly provider: string;
  readonly adapterVersion: string;
  readonly backend: SpeechProviderFingerprint;
  /** Provider-owned identifiers and alignment are recorded unchanged. */
  readonly providerMetadata?: Readonly<Record<string, SpeechJson>> | undefined;
}

export interface SpeechProviderResult {
  /** Complete PCM WAV bytes. Providers that receive PCM must wrap it before returning. */
  readonly wav: Uint8Array;
  readonly provenance: SpeechProviderProvenance;
}

export interface SpeechProvider {
  readonly id: string;
  readonly version: string;
  /** Must be local/configuration-derived; synthesis cache lookup never discovers remotely. */
  fingerprint(request: SpeechSynthesisRequest): SpeechProviderFingerprint;
  /** Explicit discovery interaction. It is never called by `synthesize`. */
  voices(
    context: { readonly signal?: AbortSignal | undefined },
  ): Promise<readonly SpeechVoice[]>;
  synthesize(
    request: SpeechSynthesisRequest,
    context: { readonly signal?: AbortSignal | undefined },
  ): Promise<SpeechProviderResult>;
}

export class SpeechProviderUnavailableError extends Error {
  readonly code = "SPEECH_PROVIDER_UNAVAILABLE";
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = "SpeechProviderUnavailableError";
  }
}

/** A provider request may have been accepted. Callers must reconcile instead of blindly retrying. */
export class SpeechDispatchUncertainError extends Error {
  readonly code = "SPEECH_DISPATCH_UNCERTAIN";
  readonly providerRequestId?: string;
  constructor(
    message: string,
    options: { cause?: unknown; providerRequestId?: string | undefined } = {},
  ) {
    super(message, options);
    this.name = "SpeechDispatchUncertainError";
    if (options.providerRequestId !== undefined) {
      this.providerRequestId = options.providerRequestId;
    }
  }
}

export interface WavPcmMetadata {
  readonly container: "wav";
  readonly audioFormat: 1;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: 8 | 16 | 24 | 32;
  readonly sampleFrames: number;
  readonly byteLength: number;
  readonly durationSeconds: number;
}

export interface SpeechSynthesisArtifact {
  readonly schemaVersion: 1;
  readonly cacheKey: string;
  readonly sha256: string;
  /** An immutable content-addressed WAV file. */
  readonly path: string;
  readonly metadata: WavPcmMetadata;
  readonly request: SpeechSynthesisRequest;
  readonly provenance: SpeechProviderProvenance;
  readonly createdAt: string;
}
