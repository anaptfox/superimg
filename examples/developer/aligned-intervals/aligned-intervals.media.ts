import { image, arrange } from "@foxworth/superimg";

export default image({
  size: { width: 1080, height: 1350 },
  render({ width, height }) {
    return arrange.alignedIntervals({
      size: { width, height },
      question: "Do these deploys overlap?",
      workRemoved: "Computing overlap, order, and concurrency across separate records",
      evidence: "derived",
      timeRef: { unit: "s", origin: 0, originLabel: "kickoff" },
      tracks: [
        { id: "east", label: "us-east", intervals: [{ start: 0, end: 40, label: "deploy" }] },
        {
          id: "west",
          label: "us-west",
          intervals: [{ start: 20, end: 70, uncertain: true, label: "deploy (skew)" }],
        },
        { id: "eu", label: "eu-west", intervals: [{ start: 80, end: 110, label: "deploy" }] },
        { id: "apac", label: "ap-south", intervals: [{ start: 35, end: 90, label: "deploy" }] },
      ],
      source: "illustrative deploy timings · west clock uncertain",
    });
  },
});
