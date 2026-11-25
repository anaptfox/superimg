//! CLI companion loading; capture and review policy live in the Node library.
import { writeReviewPacket as captureReviewPacket } from "@foxworth/superimg-node/review/advanced";
export * from "@foxworth/superimg-node/review/advanced";
import { profileStage } from "./command-profile.js";
export function writeReviewPacket(input: Parameters<typeof captureReviewPacket>[0]) {
  return captureReviewPacket({ ...input, profileStage });
}
