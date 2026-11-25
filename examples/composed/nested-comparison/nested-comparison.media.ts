import { time } from "@foxworth/superimg";
import { nestedComparison } from "./nested-comparison.js";

export default time(nestedComparison, { size: { width: 1280, height: 720 }, fps: 25 });
