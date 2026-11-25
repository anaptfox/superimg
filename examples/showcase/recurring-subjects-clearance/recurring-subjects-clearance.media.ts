import { video, Frame, Fill, Html, Text, NativeSurface, type RenderContext } from "@foxworth/superimg";
import { DURATION, sampleMorning } from "./model";
import world from "./world.ts?superimg-surface";
import { observeSpace } from "./spatial-review";
import { ORIGINAL_SPOON_POSE, SPOON_POSE } from "./spatial-data";

function renderMorning(ctx: RenderContext) {
  const { width, height } = ctx;
  const square = width === height;
  const frame = sampleMorning(ctx.timeline.seconds, square, ctx.data.spoonStaging === "touching" ? ORIGINAL_SPOON_POSE : SPOON_POSE);
  const spatial = observeSpace(frame);
  const scale = width / (square ? 1080 : 1280);
  const titleY = height * .17;
  const intro = frame.opening;
  const end = frame.ending;
  return Frame({ id: "second-cup", width, height },
    Fill({ color: "#d6c7ae" }),
    NativeSurface<ReturnType<typeof sampleMorning>>({ id: "coffee-world", module: world, width, height, seconds: ctx.timeline.seconds, data: JSON.parse(JSON.stringify(frame)), semantic: {
      kind: "scene", label: "Two recurring mugs in a boxed WebGL projection",
      metadata: { projection: "boxed-webgl", shot: frame.shot,
        spatialReview: JSON.parse(JSON.stringify(spatial)),
        subjects: [...frame.mugs, frame.spoon].map(m => ({ binding: {
          entityId: m.binding.entityId, definitionId: m.binding.definitionId,
          designRevision: m.binding.designRevision, design: m.data.design,
          appearanceId: m.binding.appearanceId ?? null, styleRevision: m.binding.styleRevision ?? null,
        }, state: m.data.state, performance: m.data.performance })), camera: frame.camera },
    } }),
    Html({ id: "light-falloff", width, height, html: `<div style="width:100%;height:100%;background:linear-gradient(to bottom,rgba(239,228,209,${.72 * end}) 0%,rgba(239,228,209,${.4 * end}) 22%,transparent 45%),radial-gradient(ellipse at 48% 42%,transparent 35%,rgba(30,16,6,.19) 100%);pointer-events:none"></div>` }),
    Frame({ id: "timestamp", x: width * .1, y: height * .1, width: width * .8, height: 40 * scale },
      Text({ size: (square ? 20 : 16) * scale, color: "#382618", weight: 500, letterSpacing: 2, fontFamily: "system-ui" }, frame.timestamp)),
    Frame({ id: "intro-copy", x: width * .1, y: titleY, width: width * .8, height: 80 * scale, style: { opacity: intro } },
      Text({ size: (square ? 43 : 38) * scale, color: "#382618", fontFamily: "Georgia", weight: 400 }, "Two mugs. One glaze.")),
    Frame({ id: "closing-copy", x: width * .1, y: height * .17, width: width * .8, height: 140 * scale, style: { opacity: end } },
      Frame({ width: width * .8, height: 70 * scale }, Text({ size: (square ? 43 : 40) * scale, color: "#382618", fontFamily: "Georgia", weight: 400 }, "Same mug, a little later.")),
      Frame({ y: 62 * scale, width: width * .8, height: 44 * scale }, Text({ size: (square ? 21 : 18) * scale, color: "#5d3f28", fontFamily: "system-ui", letterSpacing: .5 }, "The other one is still full.")),
    ),
  );
}

export default video({
  readiness: { timeoutMs: 60000 },
  size: { width: 1280, height: 720 }, duration: `${DURATION}s`, fps: 24,
  sample: { spoonStaging: "clear" }, variants: { touching: { spoonStaging: "touching" } },
  render: renderMorning,
  editions: { square: { size: { width: 1080, height: 1080 }, render: renderMorning } },
});
