//! Edge/workerd entry — binds worker-safe ensureInit.

import { edgeEnsureInit } from "./resvg-ensure-init.edge.js";
import { bindEnsureInit } from "./resvg-rasterizer.js";

bindEnsureInit(edgeEnsureInit);

export * from "./resvg-rasterizer.js";