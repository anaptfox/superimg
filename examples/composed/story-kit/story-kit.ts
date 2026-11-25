import { sequence } from "@foxworth/superimg";
import demo from "./parts/demo.media.js";
import opener from "./parts/opener.media.js";
import result from "./parts/result.media.js";

export const storySize = { width: 1200, height: 675 } as const;
export const storyFps = 25;

// Reusable authored work: the chapter remains a named composition in the film.
export const chapter = sequence([
  { id: "demo", content: demo },
  { id: "result", content: result, hold: "1s" },
]);

export const story = sequence([
  { id: "opener", content: opener, hold: "1s" },
  { id: "chapter", content: chapter },
]);
