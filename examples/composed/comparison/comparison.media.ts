import { time } from "@foxworth/superimg";
import { comparison, comparisonFps, comparisonSize } from "./comparison.js";

export default time(comparison, { size: comparisonSize, fps: comparisonFps });
