import type {
  AudioCodecPreference,
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
} from "@superimg/types";

export type DestinationPlatform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "facebook"
  | "x"
  | "pinterest"
  | "threads"
  | "reddit";

export type DestinationMedium = "image" | "video";

export type DestinationClaimAuthority = "platform" | "superimg";
export type DestinationClaimStatus = "requirement" | "recommendation";

/**
 * A value in the destination catalog together with who owns the decision.
 * Platform claims must cite an official source. SuperImg values are always
 * recommendations and intentionally remain distinguishable from requirements.
 */
export interface DestinationClaim<T> {
  readonly value: T;
  readonly authority: DestinationClaimAuthority;
  readonly status: DestinationClaimStatus;
  readonly provenanceId?: string;
}

export interface DestinationCanvas {
  readonly width: number;
  readonly height: number;
}

export interface DestinationProvenance {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

export interface DestinationVideoEncodingDefaults {
  readonly format: DestinationClaim<Extract<OutputFormat, "mp4" | "webm" | "mov" | "mkv">>;
  readonly codec: DestinationClaim<VideoCodecPreference>;
  readonly audioCodec: DestinationClaim<AudioCodecPreference>;
  readonly fps: DestinationClaim<number>;
}

export interface DestinationImageEncodingDefaults {
  readonly format: DestinationClaim<Extract<OutputFormat, "png" | "webp" | "jpeg">>;
}

export interface DestinationDefinition {
  readonly schemaVersion: 0;
  readonly id: string;
  readonly platform: DestinationPlatform;
  readonly label: string;
  readonly surface: "organic";
  readonly supportedMedia: readonly DestinationClaim<DestinationMedium>[];
  readonly recommendedCanvas: DestinationClaim<DestinationCanvas>;
  readonly encoding: {
    readonly video?: DestinationVideoEncodingDefaults;
    readonly image?: DestinationImageEncodingDefaults;
  };
  /** Date on which every cited official source was checked, in YYYY-MM-DD. */
  readonly checkedAt: string;
  readonly provenance: readonly DestinationProvenance[];
}

export type DestinationId =
  | "youtube"
  | "instagram-square"
  | "tiktok"
  | "linkedin"
  | "facebook"
  | "x"
  | "pinterest"
  | "threads"
  | "reddit";

export interface CustomDestinationTarget {
  readonly kind: "custom";
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly format?: OutputFormat;
  /** Exact target policy. Overrides a shared runtime export policy. */
  readonly encoding?: Omit<EncodingOptions, "format">;
}

export interface CatalogDestinationTarget {
  readonly kind: "catalog";
  readonly id: DestinationId;
  readonly destination: DestinationDefinition;
}

export type DestinationTarget = CatalogDestinationTarget | CustomDestinationTarget;
