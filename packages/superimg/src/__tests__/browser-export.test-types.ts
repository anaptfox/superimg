//! Consumer proof against the assembled public declarations, not private workspaces.
import {
  captureBrowserArtifact,
  captureHtmlArtifact,
  prepareBrowserVector,
  type BrowserArtifactOptions,
} from "@foxworth/superimg/browser-export";
import type { ConversionCopyOptions, ConversionVideoSelection, ConversionTrackPlan } from "@foxworth/superimg/runtime";

function capture(element: HTMLElement) {
  const options: BrowserArtifactOptions = { format: "vector-svg" };
  const result: Promise<Blob> = captureBrowserArtifact(element, { width: 640, height: 360, ...options });
  const html: Promise<Blob> = captureHtmlArtifact("<h1>Hello</h1>", { width: 640, height: 360 });
  const vector = prepareBrowserVector(element, { width: 640, height: 360 });
  return { result, html, vector };
}

const copy: ConversionCopyOptions = { mode: "required", boundaryPolicy: "shrink", shiftTolerance: 0 };
const video: ConversionVideoSelection = { sourceId: "upload", trackId: "video:1", flip: true, allowTransformationMetadata: false };
function bounds(plan: ConversionTrackPlan) { return [plan.outputStartSeconds, plan.outputEndSeconds]; }
void [capture, copy, video, bounds];
