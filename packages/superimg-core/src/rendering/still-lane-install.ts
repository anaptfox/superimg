//! The browser-free still lane. Non-Player entry points pass this to
//! `installStillLaneKit`; the Player graph never imports it.

import { lowerSvg, needsBrowser } from "@superimg/stdlib/tree";
import type { StillLaneKit } from "./still-lane-kit.js";
import { textMeasurerFromFaces } from "./text-measurer.js";

export const defaultStillLaneKit: StillLaneKit = { lowerSvg, needsBrowser, textMeasurerFromFaces };
