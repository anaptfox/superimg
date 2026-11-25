import type {
  CortexArtifactRecord,
  CortexBundle,
  ExportBundle,
  ExportOptions,
  ExportableMedia,
  PausableJob,
  Runtime,
} from "@superimg/types";
import { startExport } from "../runtime/kernel.js";
import { matchCortexView, type CortexMatch } from "./match.js";
import { cortexSample } from "./sample.js";
import { dailyReportMedia, eventStoryMedia } from "./views.js";

export class CortexNoViewError extends Error {
  readonly code = "NO_VIEW" as const;
  constructor(readonly reason: string) {
    super(reason);
    this.name = "CortexNoViewError";
  }
}

export interface CortexPlan {
  readonly match: Extract<CortexMatch, { ok: true }>;
  readonly media: ExportableMedia;
  readonly data: ReturnType<typeof cortexSample>;
}

const VIEWS = {
  "event-story": eventStoryMedia,
  "daily-project-report": dailyReportMedia,
} as const;

export function planCortexRender(
  bundle: CortexBundle,
  options: { viewId?: string } = {},
): CortexPlan {
  const match = matchCortexView(bundle, options);
  if (!match.ok) throw new CortexNoViewError(match.reason);
  return {
    match,
    media: VIEWS[match.viewId],
    data: cortexSample(bundle),
  };
}

export function startCortexExport(
  runtime: Runtime,
  bundle: CortexBundle,
  options: ExportOptions & { viewId?: string },
): PausableJob<ExportBundle> {
  const { viewId, ...exportOptions } = options;
  const plan = planCortexRender(bundle, viewId === undefined ? {} : { viewId });
  return startExport(runtime, plan.media, { ...exportOptions, data: plan.data });
}

export function cortexArtifactRecord(plan: CortexPlan): CortexArtifactRecord {
  return Object.freeze({
    viewId: plan.match.viewId,
    reason: plan.match.reason,
  });
}
