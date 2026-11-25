export * from "./html/html.js";
export * from "./html/browser-probes.js";

import { installStillLaneKit } from "./rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "./rendering/still-lane-install.js";

installStillLaneKit(defaultStillLaneKit);
