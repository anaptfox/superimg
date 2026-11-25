import { Image } from "../../superimg-stdlib/src/tree/primitives.js";
import { Instance, Scene, visual } from "../../superimg-stdlib/src/tree/scene.js";
import { vector } from "../../superimg-stdlib/src/tree/vector.js";
import { installSuperImgSampler } from "../authoring.js";

interface MeadowState {
  nellX: number;
  previousX: number;
  acceptedTime: number;
}

const ground = visual<{ width: number; height: number }>({
  id: "ground",
  render: ({ data }) => ({
    parts: [{
      id: "grass",
      band: -1,
      bounds: { x: 0, y: 0, ...data },
      content: vector.rect({ ...data, fill: "#203e32" }),
    }],
  }),
});

const nell = visual<null>({
  id: "nell",
  render: () => ({
    anchors: { talk: { x: 0, y: -28 } },
    parts: [
      {
        id: "shadow",
        band: -0.5,
        bounds: { x: -10, y: -3, width: 20, height: 6 },
        content: vector.ellipse({ rx: 10, ry: 3, fill: "#142b25" }),
      },
      {
        id: "body",
        bounds: { x: -8, y: -24, width: 16, height: 24 },
        content: Image({ src: "nell", fit: "fill" }),
      },
    ],
  }),
});

installSuperImgSampler<MeadowState>((seconds, viewport, state) => {
  const progress = viewport.reduceMotion ? 1 : Math.max(0, Math.min(1, (seconds - state.acceptedTime) / 0.18));
  const x = state.previousX + (state.nellX - state.previousX) * progress;
  const y = Math.round(viewport.height * 0.55);
  return Scene({ id: "meadow", width: viewport.width, height: viewport.height },
    Instance({ id: "ground", of: ground, data: { width: viewport.width, height: viewport.height }, semantic: { space: "screen" } }),
    Instance({ id: "nell", entityId: "nell", of: nell, data: null, at: { x, y }, semantic: { space: "screen" } }),
  );
});
