// The recap film: slate → the night → tail. One reel, cut in camera.
// Each scene is its own media program and renders on its own; sequence()/time()
// orders each cut and applies transitions between them.

import { sequence, time } from "@foxworth/superimg";
import intro from "./intro.media.js";
import content from "./content.media.js";
import outro from "./outro.media.js";

const recap = sequence([
  { id: "slate", content: intro },
  {
    id: "night",
    content: content,
    enter: { type: "fade", duration: "160ms", easing: "easeOutCubic" },
  },
  {
    id: "tail",
    content: outro,
    enter: { type: "fade", duration: "160ms", easing: "easeOutCubic" },
  },
]);

export default time(recap, {
  size: { width: 1920, height: 1080 },
  fps: 30,
});
