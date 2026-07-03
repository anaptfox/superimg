//! Node entry — binds auto-loading ensureInit.

import { nodeEnsureInit } from "./resvg-ensure-init.node.js";
import { bindEnsureInit } from "./resvg-rasterizer.js";

bindEnsureInit(nodeEnsureInit);

export * from "./resvg-rasterizer.js";