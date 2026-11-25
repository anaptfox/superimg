import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import type { SceneSnapshot, SceneNodeSnapshot } from "@foxworth/superimg/interactive/define";
import { MeaningDrawer } from "../src/components/MeaningDrawer";
import { indexScene } from "../src/kit/scene-index";

it.skipIf(process.env.SUPERIMG_STUDIO_PERF !== "1")("counts inspector indexing work across synthetic graph sizes", () => {
  const rows = [];
  for (const count of [100, 1000, 5000]) {
    const nodes: SceneNodeSnapshot[] = Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`, kind: "subject", role: i % 10 === 0 ? "evidence" : "subject", label: null, state: null,
      parentId: i === 0 ? null : "node-0", childIds: i === 0 ? Array.from({ length: count - 1 }, (_, j) => `node-${j + 1}`) : [],
      tags: [], actions: [], space: "world", visible: true, opacity: 1, transform: {}, animation: null, properties: {}, metadata: {},
    }));
    const snapshot: SceneSnapshot = { schemaVersion: 0, sceneId: "synthetic-studio-perf", activeState: null, rootIds: ["node-0"], nodes, states: {}, camera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null } };
    const matches = nodes.filter(node => node.role === "evidence");
    const OriginalMap = globalThis.Map;
    let nodeMaps = 0;
    let indexedPairs = 0;
    class CountingMap<K, V> extends OriginalMap<K, V> {
      constructor(entries?: Iterable<readonly [K, V]> | null) {
        super(entries);
        if (Array.isArray(entries) && entries.length === count && entries[0]?.[0] === "node-0") {
          nodeMaps++;
          indexedPairs += entries.length;
        }
      }
    }
    let html: string;
    // Count work only. Map instrumentation is deliberately excluded from timing claims.
    globalThis.Map = CountingMap;
    try {
      html = renderToStaticMarkup(createElement(MeaningDrawer, { index: indexScene(snapshot), selected: nodes[0]!, selectedId: "node-0", queryRole: "evidence", queryMatches: matches, roleFilters: [{ role: "evidence", label: "evidence" }], onQuery() {}, onSelect() {} }));
    } finally {
      globalThis.Map = OriginalMap;
    }
    expect(html).toContain(`→ ${matches.length}`);
    expect((html.match(/data-node-id=/g) ?? []).length).toBe(matches.length);
    // Deterministic work bound: one snapshot index, independent of match count.
    expect(nodeMaps).toBe(1);
    expect(indexedPairs).toBe(count);
    rows.push({ nodes: count, matches: matches.length, nodeMaps, indexedPairs, htmlBytes: Buffer.byteLength(html) });
  }
  const output = process.env.SUPERIMG_STUDIO_PERF_DIR;
  if (!output) throw new Error("Set SUPERIMG_STUDIO_PERF_DIR to a fresh evidence directory");
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/inspector-counts.json`, JSON.stringify({ workload: "synthetic star graph, 10% evidence matches; actual MeaningDrawer/SemanticTree React server render; counts only, not browser latency", rows }, null, 2), { flag: "wx" });
});
