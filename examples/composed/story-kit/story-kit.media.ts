import { time } from "@foxworth/superimg";
import { story, storyFps, storySize } from "./story-kit.js";

// 25f opener + 7f demonstration + 25f result = exactly 57 output frames.
export default time(story, { size: storySize, fps: storyFps });
