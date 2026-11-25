import { choose, sequence } from "@foxworth/superimg";
import advanced from "./parts/advanced.media.js";
import beginner from "./parts/beginner.media.js";
import closing from "./parts/closing.media.js";
import question from "./parts/question.media.js";

export const lessonSize = { width: 1280, height: 720 } as const;
export const lessonFps = 25;

export type LessonPath = "beginner" | "advanced";

export const lesson = sequence([
  { id: "question", content: question, hold: "1s" },
  {
    id: "lesson",
    content: choose({ beginner, advanced }),
  },
  { id: "closing", content: closing, hold: "1s" },
]);
