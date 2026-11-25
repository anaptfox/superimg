//! Add compact browser observation coverage without copying captured geometry.
import type { JsonObject, RuntimeFinding, RuntimeTechnicalCoverage } from "@superimg/types";
import { mergeTechnicalCoverage } from "../validation/analysis.js";

export function withRenderedLayoutCoverage(
  source: RuntimeTechnicalCoverage | undefined,
  metadata: Readonly<JsonObject> | undefined,
  findings: readonly RuntimeFinding[],
): RuntimeTechnicalCoverage | undefined {
  const observations = metadata?.renderedLayout;
  const records: Record<string, unknown>[] = [];
  if (Array.isArray(observations)) for (const item of observations) if (isRecord(item)) records.push(item);
  if (!records.length && !findings.some(finding => finding.code === "RENDERED_LAYOUT_FAILED")) return source;
  const base = source ?? mergeTechnicalCoverage([]);
  let measured = 0, opaque = 0;
  const unsupported = new Set(base.unsupported);
  const checks = [...base.checks];
  for (const record of records) {
    const nodes = Array.isArray(record.nodes) ? record.nodes.filter(isRecord) : [];
    measured += nodes.length;
    const coverage = isRecord(record.coverage) ? record.coverage : {};
    const regions = Array.isArray(coverage.opaque) ? coverage.opaque.length : 0;
    opaque += regions;
    if (coverage.truncated === true) unsupported.add("browser-observation-truncated");
    if (regions) unsupported.add("browser-opaque-regions");
    if (nodes.some(node => typeof node.id !== "string" || !node.id)) unsupported.add("browser-nodes-without-semantic-id");
    if (typeof record.frame === "number") checks.push({ id: "rendered-layout", scope: "frame", frames: [record.frame] });
  }
  if (findings.some(finding => finding.code === "RENDERED_LAYOUT_FAILED")) unsupported.add("rendered-layout-unavailable");
  return { ...base, checks, geometry: { ...base.geometry, browserMeasuredNodes: measured, browserOpaqueRegions: opaque, opaqueRegions: base.geometry.opaqueRegions + opaque }, unsupported: [...unsupported] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
