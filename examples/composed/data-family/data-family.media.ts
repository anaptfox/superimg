import { time } from "@foxworth/superimg";
import { program } from "./data-family.js";

export default time(program, {
  size: { width: 1280, height: 720 },
  fps: 25,
});
