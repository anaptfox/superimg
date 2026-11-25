import { expect, it } from "vitest";
import * as review from "./review.js";
import * as advanced from "./review-advanced.js";
import * as source from "./source.js";
import * as project from "./project.js";
import * as tools from "./project-tools.js";
import * as narration from "./narration.js";

it("keeps compatibility functions while presenting direct operations", () => {
  expect(review.captureValueReview).toBeTypeOf("function");
  expect(review.captureSourceReview).toBeTypeOf("function");
  expect(review.captureDeliveryReview).toBeTypeOf("function");
  expect(advanced.writeReviewPacket).toBeTypeOf("function");
  expect(review).not.toHaveProperty("writeReviewPacket");
  expect(source.compileNodeMediaSource).toBeTypeOf("function");
  expect(source.loadNodeMediaValue).toBeTypeOf("function");
  expect(source.checkCompiledSource).toBeTypeOf("function");
  expect(source.inspectCompiledSource).toBeTypeOf("function");
  expect(source.checkNodeSource).toBeTypeOf("function");
  expect(source.inspectPreparedSource).toBeTypeOf("function");
  expect(project.discoverMediaSources).toBe(tools.discoverMediaSources);
  expect(narration.createNodeNarrationService).toBeTypeOf("function");
  expect(narration.publishDirectory).toBeTypeOf("function");
});
