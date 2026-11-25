//! One portable scanner pipeline for authored frame and sampled-sequence evidence.
import type { RuntimeTechnicalCoverage, ValidationIssue, RuntimeFinding, RuntimeMediaCoordinates, JsonObject } from "@superimg/types";
import { scanHtmlIssues, scanAllFramesEmpty } from "./scanners.js";
import { scanTreePaintIssues } from "./tree-paint.js";
import { missingTreeIssue, scanTreeLayoutIssues, scanTreeSemanticIssues, type SemanticTreeNode, type TreeCheckIssue } from "./tree.js";
import { scanIdentityFlicker } from "./tree-sequence.js";

export interface TechnicalFrame {
  readonly frame: number;
  readonly progress: number;
  readonly html: string;
  readonly nodes?: readonly SemanticTreeNode[];
  readonly width: number;
  readonly height: number;
  readonly background?: string;
}
export interface TechnicalAnalysis {
  readonly issues: readonly (ValidationIssue | TreeCheckIssue)[];
  readonly coverage: RuntimeTechnicalCoverage;
}

/** Public findings carry identities/provenance, never captured HTML or path data. */
export function technicalRuntimeFindings(analysis: TechnicalAnalysis, coordinates?: RuntimeMediaCoordinates): RuntimeFinding[] {
  return analysis.issues.map(issue => {
    const { d: _pathData, ...safeDetails } = issue.details ?? {};
    return {
      code: issue.code, severity: issue.severity, category: "render" as const, message: issue.message,
      ...(issue.suggestion ? { suggestion: issue.suggestion } : {}),
      ...(coordinates ? { coordinates } : {}),
      details: JSON.parse(JSON.stringify({ ...safeDetails, ...(issue.frame !== undefined ? { frame: issue.frame } : {}), ...(issue.progress !== undefined ? { progress: issue.progress } : {}), ...(issue.nodeId ? { nodeId: issue.nodeId } : {}), ...(issue.nodePath ? { nodePath: issue.nodePath } : {}) })) as JsonObject,
    };
  });
}

export function analyzeTechnicalFrame(input: TechnicalFrame): TechnicalAnalysis {
  const { frame, progress, nodes } = input;
  const issues: (ValidationIssue | TreeCheckIssue)[] = [...scanHtmlIssues(input.html, frame, progress)];
  if (!input.html.trim()) issues.push({ severity: "error", code: "RENDER_RETURNED_EMPTY", message: "render() lowered to empty markup at this sampled frame", frame, progress });
  const checks = [{ id: "html-output", scope: "frame" as const, frames: [frame] }];
  if (nodes) {
    issues.push(...scanTreeLayoutIssues(nodes, { frame, progress }), ...scanTreeSemanticIssues(nodes, { frame, progress }), ...scanTreePaintIssues(nodes, input));
    checks.push(...["tree-layout", "tree-semantics", "tree-paint"].map(id => ({ id, scope: "frame" as const, frames: [frame] })));
  } else issues.push(missingTreeIssue({ frame, progress }));
  return { issues, coverage: {
    samples: [{ frame, progress }], checks,
    geometry: {
      sourceEstimatedNodes: (nodes ?? []).filter(node => node.bounds !== undefined || node.layout !== undefined).length,
      fontMeasuredNodes: (nodes ?? []).filter(node => node.metricsExact === true).length,
      browserMeasuredNodes: 0,
      opaqueRegions: nodes ? nodes.filter(node => node.opaque || node.tag === "Html").length : 1,
    },
    unsupported: [...new Set([...(nodes ? [] : ["media-tree-unavailable"]), ...issues.filter(issue => issue.code === "TEXT_PAINT_UNVERIFIED").map(() => "complex-text-paint"), ...issues.filter(issue => issue.code === "TEXT_GEOMETRY_UNVERIFIED").map(() => "complex-text-geometry"), ...issues.filter(issue => issue.code === "TEXT_METRICS_APPROXIMATE").map(() => "approximate-text-metrics")])],
    visual: "unreviewed",
  } };
}

/** A single-frame request never claims identity or all-samples sequence checks. */
export function analyzeTechnicalSequence(samples: readonly TechnicalFrame[]): TechnicalAnalysis {
  const frames = [...new Map(samples.map(sample => [sample.frame, sample])).values()];
  const analyses = frames.map(analyzeTechnicalFrame);
  const issues = analyses.flatMap(analysis => [...analysis.issues]);
  const coverage = mergeTechnicalCoverage(analyses.map(analysis => analysis.coverage));
  const checks = [...coverage.checks];
  if (frames.length > 1) {
    issues.push(...scanAllFramesEmpty(frames.map(sample => sample.html)));
    checks.push({ id: "sampled-output-presence", scope: "sequence", frames: frames.map(sample => sample.frame) });
  }
  if (frames.length >= 3 && frames.every(sample => sample.nodes !== undefined)) {
    issues.push(...scanIdentityFlicker(frames.map(sample => ({ frame: sample.frame, progress: sample.progress, nodes: sample.nodes! }))));
    checks.push({ id: "sampled-identity", scope: "sequence", frames: frames.map(sample => sample.frame) });
  }
  return { issues, coverage: { ...coverage, checks } };
}

export function mergeTechnicalCoverage(values: readonly RuntimeTechnicalCoverage[]): RuntimeTechnicalCoverage {
  return {
    samples: values.flatMap(value => [...value.samples]), checks: values.flatMap(value => [...value.checks]),
    geometry: values.reduce((sum, value) => ({
      sourceEstimatedNodes: sum.sourceEstimatedNodes + value.geometry.sourceEstimatedNodes,
      fontMeasuredNodes: sum.fontMeasuredNodes + value.geometry.fontMeasuredNodes,
      browserMeasuredNodes: sum.browserMeasuredNodes + value.geometry.browserMeasuredNodes,
      opaqueRegions: sum.opaqueRegions + value.geometry.opaqueRegions,
      browserOpaqueRegions: sum.browserOpaqueRegions + (value.geometry.browserOpaqueRegions ?? 0),
    }), { sourceEstimatedNodes: 0, fontMeasuredNodes: 0, browserMeasuredNodes: 0, opaqueRegions: 0, browserOpaqueRegions: 0 }),
    unsupported: [...new Set(values.flatMap(value => [...value.unsupported]))], visual: "unreviewed",
  };
}

/** Preserve adapter findings and collapse repeated observations of the same defect. */
export function mergeTechnicalFindings(existing: readonly RuntimeFinding[], analysis: TechnicalAnalysis, coordinates?: RuntimeMediaCoordinates): RuntimeFinding[] {
  const seen = new Set<string>();
  return [...existing, ...technicalRuntimeFindings(analysis, coordinates)].filter(finding => {
    const key = JSON.stringify([finding.code, finding.message, finding.coordinates, finding.details?.frame, finding.details?.nodeId, finding.details?.nodePath]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Extend a command's sampled source scope while retaining adapter observations. */
export function mergeTechnicalScopes(current: RuntimeTechnicalCoverage, previous?: RuntimeTechnicalCoverage): RuntimeTechnicalCoverage {
  if (!previous) return current;
  const sampleKey = (sample: RuntimeTechnicalCoverage["samples"][number]) => JSON.stringify([sample.frame, sample.coordinates]);
  const currentSamples = new Set(current.samples.map(sampleKey));
  const outside = previous.samples.some(sample => !currentSamples.has(sampleKey(sample)));
  const unique = <T>(values: readonly T[], key: (value: T) => string): T[] => [...new Map(values.map(value => [key(value), value])).values()];
  return { ...current,
    samples: unique([...current.samples, ...previous.samples], sampleKey),
    checks: unique([...current.checks, ...previous.checks], check => JSON.stringify(check)),
    geometry: {
      sourceEstimatedNodes: current.geometry.sourceEstimatedNodes + (outside ? previous.geometry.sourceEstimatedNodes : 0),
      fontMeasuredNodes: current.geometry.fontMeasuredNodes + (outside ? previous.geometry.fontMeasuredNodes : 0),
      browserMeasuredNodes: previous.geometry.browserMeasuredNodes + current.geometry.browserMeasuredNodes,
      browserOpaqueRegions: (previous.geometry.browserOpaqueRegions ?? 0) + (current.geometry.browserOpaqueRegions ?? 0),
      opaqueRegions: current.geometry.opaqueRegions + (previous.geometry.browserOpaqueRegions ?? 0) + (outside ? previous.geometry.opaqueRegions - (previous.geometry.browserOpaqueRegions ?? 0) : 0),
    },
    unsupported: [...new Set([...current.unsupported, ...previous.unsupported])],
  };
}
