import { time } from "@foxworth/superimg";
import { mixedMedia, mixedMediaFps, mixedMediaSize } from "./mixed-media.js";

export default time(mixedMedia, { size: mixedMediaSize, fps: mixedMediaFps });
