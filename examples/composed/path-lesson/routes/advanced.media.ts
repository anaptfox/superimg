import { time } from "@foxworth/superimg";
import { lesson, lessonFps, lessonSize } from "../path-lesson.js";

// A second deterministic projection of the same authored Program.
export default time(lesson, {
  size: lessonSize,
  fps: lessonFps,
  routes: { lesson: "advanced" },
});
