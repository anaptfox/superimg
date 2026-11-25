// The Winter Sky — a four-chapter vector film composed from local scenes.
// Title → magnitudes → asterism → colophon, all drawn on the same plate.
import { sequence, time } from "@foxworth/superimg";
import intro from "./intro.media.js";
import stars from "./stars.media.js";
import asterism from "./asterism.media.js";
import outro from "./outro.media.js";

export default time(sequence([
  { id: "intro", content: intro },
  { id: "stars", content: stars },
  { id: "asterism", content: asterism },
  { id: "colophon", content: outro },
]), {
  size: { width: 1920, height: 1080 },
  fps: 30,
});
