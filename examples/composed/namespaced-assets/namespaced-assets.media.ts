import { sequence, time } from "@foxworth/superimg";
import first from "./parts/first/clip.media.js";
import second from "./parts/second/clip.media.js";

// `time()` promotes child declarations to root config.assets as
// `first/logo` and `second/logo`, while each child still asks for `logo`.
export default time(sequence([
  { id: "first", content: first, hold: "25f" },
  { id: "second", content: second, hold: "25f" },
]), { size: { width: 640, height: 360 }, fps: 25 });
