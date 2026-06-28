import { compose, scene } from "superimg";
import barScene from "./bar-scene.media.js";
import lineScene from "./line-scene.media.js";

export default compose(
  [
    scene(barScene, {
      id: "bar-race",
      label: "Bar Race",
      enter: { type: "slide-left", duration: "700ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "500ms" },
    }),
    scene(lineScene, {
      id: "line-trend",
      label: "Line Trend",
      enter: { type: "slide-right", duration: "700ms", easing: "easeOutCubic" },
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