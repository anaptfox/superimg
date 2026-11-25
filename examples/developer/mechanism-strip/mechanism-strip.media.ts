import { image } from "@foxworth/superimg";
import { mechanismStrip } from "@foxworth/superimg/stdlib/arrange";

export default image({
  size: { width: 1080, height: 1080 },
  render() {
    return mechanismStrip({
      question: "How does a media program become bytes?",
      workRemoved:
        "Opening five packages to learn which stage hands what to the next, and on what evidence",
      evidence: "derived",
      source: "packages/*/package.json dependencies, read 2026-09-08",
      nodes: [
        { id: "types", label: "types", note: "define() contract" },
        { id: "core", label: "core", note: "Media IR" },
        { id: "playwright", label: "playwright", note: "rasterize" },
        { id: "node", label: "node", note: "encode" },
        { id: "cli", label: "cli", note: "export bundle" },
      ],
      edges: [
        { from: "types", to: "core", claim: "derived", label: "media value" },
        { from: "core", to: "playwright", claim: "derived", label: "laid-out tree" },
        { from: "playwright", to: "node", claim: "derived", label: "frame buffers" },
        { from: "node", to: "cli", claim: "derived", label: "encoded file" },
      ],
      layout: {
        kind: "pipeline",
        order: ["types", "core", "playwright", "node", "cli"],
      },
    });
  },
});
