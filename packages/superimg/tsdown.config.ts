/**
 * Default config for `tsdown --watch` (dev). Production builds use sequential
 * platform configs via package.json — see tsdown.node.ts / edge / browser.
 */
import nodeConfig from "./tsdown.node.ts";
import edgeConfig from "./tsdown.edge.ts";
import browserConfig from "./tsdown.browser.ts";

export default [nodeConfig, edgeConfig, browserConfig];