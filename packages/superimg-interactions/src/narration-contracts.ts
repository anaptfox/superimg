import type { MediaArtifactTarget, MediaJsonObject } from "./contracts.js";

import type { SpeechProviderId } from "@superimg/node/narration";
export type { SpeechProviderId } from "@superimg/node/narration";
export interface SpeechVoicesInput {
  readonly provider: SpeechProviderId;
}
export interface SpeechSynthesizeInput {
  readonly provider: SpeechProviderId;
  readonly request: MediaJsonObject;
  readonly target: MediaArtifactTarget;
  readonly refresh?: boolean;
}
export interface NarrationPrepareInput {
  readonly recipe: MediaJsonObject;
  readonly target: MediaArtifactTarget;
  readonly preview?: boolean;
  readonly refresh?: boolean;
}
export interface NarrationReviewInput {
  readonly target: MediaArtifactTarget;
  /** Encoded file id under the same host-owned target root. */
  readonly encodedArtifactId?: string;
}
/** Portable results contain logical target identity; private host paths never cross dispatch. */
export type NarrationInteractionResult = MediaJsonObject;
