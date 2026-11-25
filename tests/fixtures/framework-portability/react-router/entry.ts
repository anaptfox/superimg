//! React Router Framework Mode entry (unpublished fixture).

import {
  loaderPayload,
  posterFromLoader,
} from "@superimg/react-router";
import { superimgViteConfig } from "@superimg/adapters/vite";
import { fixtureMediaIR } from "../shared/sample-ir.js";

export const viteConfig = superimgViteConfig({ base: "/app/" });

export function routeLoader() {
  return loaderPayload(fixtureMediaIR, {
    data: { title: "react-router fixture" },
  });
}

export function ssrPosterFromLoader() {
  return posterFromLoader(routeLoader());
}
