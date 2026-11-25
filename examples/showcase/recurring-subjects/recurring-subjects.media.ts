import { video, Frame, Fill, Text, Vector, vector, visual, subjectSet, Instance, Scene } from "@foxworth/superimg";

type MugData = {
  design: { ceramic: string; handle: string };
  state: { fill: number };
  performance: { steam: number };
};
const mug = visual<MugData>({
  id: "ceramic-mug",
  render: ({ data }) => ({
    parts: [{ id: "cup", bounds: { x: 0, y: 0, width: 130, height: 130 },
      content: Vector({ width: 130, height: 130 },
        vector.path({ d: "M90 45H105C131 45 131 90 105 90H90", fill: "none", stroke: data.design.handle, strokeWidth: 10 }),
        vector.path({ d: "M10 35H95V100Q95 120 75 120H30Q10 120 10 100Z", fill: data.design.ceramic }),
        vector.path({ d: `M15 ${42 + 60 * (1 - data.state.fill)}H90V100Q90 114 75 114H30Q15 114 15 100Z`, fill: "#523326" }),
        vector.path({ d: "M42 25Q30 17 42 5M65 25Q53 17 65 5", fill: "none", stroke: "#eedac0", strokeWidth: 3, opacity: data.performance.steam }),
      ) }],
    anchors: { handle: { x: 105, y: 65 } },
  }),
});

// A host can supply these immutable accepted values and revision references.
export const subjects = subjectSet({
  designs: { ceramic: { of: mug, design: { ceramic: "#d6a46c", handle: "#b17a48" }, revision: "ceramic-1", styleRevision: "warm-ink-1" } },
  entities: { breakfast: { design: "ceramic" }, counter: { design: "ceramic" } },
});

function renderMugs(width: number, height: number, storySeconds: number) {
  const close = storySeconds >= 2;
  const square = width === height;
  const scale = square ? width / 400 : Math.min(width / 640, height / 360);
  const leftScale = scale * (close ? 1.35 : 1);
  return Frame({ width, height },
    Fill({ color: "#202a29" }),
    Scene({ id: close ? "after-sip" : "before-sip", width, height },
      Instance({ ...subjects.sample("breakfast", {
        state: { fill: close ? 0.5 : 1 },
        performance: { steam: 0.6 + 0.3 * Math.sin(storySeconds * 2) },
      }), id: "left-cup", at: { x: width * (square ? 0.08 : 0.19), y: height * 0.4 }, transform: { scale: leftScale } }),
      Instance({ ...subjects.sample("counter", {
        state: { fill: 1 }, performance: { steam: 0.6 },
      }), id: "right-cup", at: { x: width * (square ? 0.58 : 0.64), y: height * 0.4 }, transform: { scale } }),
    ),
    Frame({ x: width * 0.08, y: height * 0.1, width: width * 0.84, height: height * 0.22 },
      Text({ size: 23 * scale, color: "#f5ead8", fontFamily: "system-ui", weight: 600 }, close ? "After the sip. Same two mugs." : "One design. Two independent mugs."),
    ),
    Frame({ x: width * 0.08, y: height * 0.85, width: width * 0.84, height: height * 0.1 },
      Text({ size: 14 * scale, color: "#d6a46c", fontFamily: "system-ui" }, "Breakfast changes. Counter stays full."),
    ),
  );
}

export default video({
  size: { width: 640, height: 360 }, duration: "4s", fps: 12,
  render: ctx => renderMugs(ctx.width, ctx.height, ctx.timeline.seconds),
  editions: { square: { size: { width: 640, height: 640 }, render: ctx => renderMugs(ctx.width, ctx.height, ctx.timeline.seconds) } },
});
