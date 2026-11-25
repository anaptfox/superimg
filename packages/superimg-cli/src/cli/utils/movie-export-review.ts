//! CLI supplies project-owned companion loading and publication.
import { prepareMovieExportReview as prepare, assertMovieReviewCurrent } from "@foxworth/superimg-node/review/advanced";
import { decodeNodeMovieFrames } from "@superimg/node/runtime";
import { loadReviewPlan } from "./review-packet.js";
import { createReviewCapture, publishProjectReview } from "./project-review-store.js";
export { assertMovieReviewCurrent };
export function prepareMovieExportReview(template: Parameters<typeof prepare>[0], description: Parameters<typeof prepare>[1], options: Parameters<typeof prepare>[2]) {
  return prepare(template, description, options, { loadReviewPlan, createReviewCapture, publishProjectReview, decodeMovie: decodeNodeMovieFrames });
}
