import { image, arrange } from "@foxworth/superimg";
export default image({
  size: { width: 1920, height: 1080 },
  render(ctx) {
    return arrange.alignedIntervals({
      question: "Does the error spike overlap the deploy?",
      workRemoved: "Computing overlap across separate deployment and error logs",
      evidence: "derived",
      size: { width: ctx.width, height: ctx.height },
      timeRef: { unit: "s", origin: 0 },
      tracks: [
        { id: "deploy", label: "Deploy", intervals: [{ id: "deploy-bar", start: 0, end: 40 }] },
        { id: "errors", label: "Error spike", intervals: [{ id: "error-bar", start: 20, end: 70 }] },
      ],
      motion: { phase: "reveal", revealIds: ["errors"], predict: "tick" },
      source: "Illustrative timings; overlap does not establish causality",
    });
  },
});
