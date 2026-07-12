import { compose, scene } from "superimg";
import gradientWash from "../gradient-wash/gradient-wash.media.js";
import splineDraw from "../spline-draw/spline-draw.media.js";
import barRace from "../../data/bar-race/bar-race.media.js";
import wireframeCube from "../wireframe-cube/wireframe-cube.media.js";

export default compose(
  [
    scene(gradientWash, {
      id: "gradient-wash",
      label: "Gradient Wash",
      enter: { type: "fade", duration: "600ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "500ms" },
    }),
    scene(splineDraw, {
      id: "spline-draw",
      label: "Spline Draw",
      enter: { type: "slide-up", duration: "700ms", easing: "easeOutCubic" },
      // Exit left so the bar-race scene's slide-left entrance carries the momentum
      exit: { type: "slide-left", duration: "600ms", easing: "easeInCubic" },
    }),
    scene(barRace, {
      id: "bar-race",
      label: "Bar Race",
      enter: { type: "slide-left", duration: "700ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "500ms" },
    }),
    scene(wireframeCube, {
      id: "wireframe-cube",
      label: "Wireframe Cube",
      enter: { type: "fade", duration: "800ms", easing: "easeOutCubic" },
    }),
  ],
  {
    config: {
      width: 1920,
      height: 1080,
      fps: 30,
      fonts: ["Inter:wght@400;600;700"],
    },
  },
);