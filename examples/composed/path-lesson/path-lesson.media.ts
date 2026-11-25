import { time } from "@foxworth/superimg";
import { lesson, lessonFps, lessonSize } from "./path-lesson.js";

// The beginner route is the sample export. The advanced route is selected by
// passing routes: { lesson: "advanced" } to time() in the browser host.
export default time(lesson, {
  size: lessonSize,
  fps: lessonFps,
  routes: { lesson: "beginner" },
});
