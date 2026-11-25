import type { SemanticTreeNode, TreeCheckIssue } from "./tree.js";
const nodePath = (node: SemanticTreeNode, index: number) => node.path ?? `/${index}`;

export function scanIdentityFlicker(
  samples: Array<{
    progress: number;
    frame: number;
    nodes?: readonly SemanticTreeNode[];
  }>,
): TreeCheckIssue[] {
  const ordered = [...samples].sort((a, b) => a.progress - b.progress);
  const ids = new Set<string>();
  for (const sample of ordered) {
    for (const node of sample.nodes ?? []) {
      if (node.id) ids.add(node.id);
    }
  }
  const issues: TreeCheckIssue[] = [];
  for (const id of ids) {
    const series = ordered.map((sample) => {
      const nodes = (sample.nodes ?? []) as SemanticTreeNode[];
      const index = nodes.findIndex((node) => node.id === id);
      const node = index >= 0 ? nodes[index] : undefined;
      return {
        progress: sample.progress,
        frame: sample.frame,
        present: Boolean(node),
        opacity: node?.motion?.opacity,
        path: node ? nodePath(node, index) : undefined,
      };
    });
    for (let i = 1; i < series.length - 1; i++) {
      const prev = series[i - 1]!;
      const mid = series[i]!;
      const next = series[i + 1]!;
      const vanished = prev.present && !mid.present && next.present;
      const opacityDip =
        prev.present &&
        mid.present &&
        next.present &&
        (prev.opacity ?? 1) > 0.8 &&
        (mid.opacity ?? 1) < 0.15 &&
        (next.opacity ?? 1) > 0.8;
      if (vanished || opacityDip) {
        const path = mid.path ?? prev.path ?? next.path;
        issues.push({
          severity: "error",
          code: "IDENTITY_FLICKER",
          message: vanished
            ? `#${id} vanishes then returns (${mid.progress.toFixed(2)} → ${next.progress.toFixed(2)})`
            : `#${id} opacity ${prev.opacity?.toFixed(2)} → ${mid.opacity?.toFixed(2)} → ${next.opacity?.toFixed(2)}`,
          frame: mid.frame,
          progress: mid.progress,
          suggestion: `Give the node a stable id and one mix. Reproduce: superimg inspect <template> --diff ${prev.progress.toFixed(2)},${next.progress.toFixed(2)}`,
          nodeId: id,
          ...(path === undefined ? {} : { nodePath: path }),
        });
        break;
      }
    }
  }
  return issues;
}
