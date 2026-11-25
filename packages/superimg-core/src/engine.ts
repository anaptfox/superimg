export * from "./rendering/engine.js";
export * from "./rendering/render-frame.js";
export * from "./rendering/resolve-template.js";
export * from "./rendering/resvg-rasterizer.node.js";
export * from "./rendering/fonts.js";
export {
  textMeasurerFromFaces,
  textMeasurerFromResolved,
  measurerForPlan,
  rememberPlanMeasurer,
} from "./rendering/text-measurer.js";
export { textMeasurerForDeclarations } from "./rendering/text-measurer-declarations.js";
export * from "./rendering/rasterizer-registry.js";

import { installStillLaneKit } from "./rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "./rendering/still-lane-install.js";

installStillLaneKit(defaultStillLaneKit);
