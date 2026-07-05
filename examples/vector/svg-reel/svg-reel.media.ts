import { compose, scene } from "superimg";
import intro from "./intro.media.js";
import fourier from "./fourier.media.js";
import morph from "./morph.media.js";
import orbit from "./orbit.media.js";
import outro from "./outro.media.js";

export default compose(
  [
    scene(intro, {
      id: "intro",
      label: "Vector Reel",
      enter: { type: "fade", duration: "500ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "600ms" },
    }),
    scene(fourier, {
      id: "fourier",
      label: "Fourier Epicycles",
      enter: { type: "slide-left", duration: "800ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "500ms" },
    }),
    scene(morph, {
      id: "morph",
      label: "Shape Morph",
      enter: { type: "fade", duration: "600ms", easing: "easeOutCubic" },
      exit: { type: "slide-up", duration: "700ms", easing: "easeInCubic" },
    }),
    scene(orbit, {
      id: "orbit",
      label: "Orbital Trails",
      enter: { type: "slide-up", duration: "700ms", easing: "easeOutCubic" },
      exit: { type: "fade", duration: "500ms" },
    }),
    scene(outro, {
      id: "outro",
      label: "Outro",
      enter: { type: "fade", duration: "800ms", easing: "easeOutCubic" },
    }),
  ],
  {
    config: {
      width: 1920,
      height: 1080,
      fps: 30,
      fonts: ["Inter:wght@400;600;800", "JetBrains+Mono:wght@400"],
    },
  },
);