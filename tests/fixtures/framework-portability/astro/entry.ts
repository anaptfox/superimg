//! Astro island entry (unpublished fixture).

import {
  buildShellPayload,
  posterFragment,
} from "@superimg/astro";
import { fixtureMediaIR } from "../shared/sample-ir.js";

export function astroServerPoster() {
  const payload = buildShellPayload(fixtureMediaIR, {
    alt: "astro fixture",
  });
  return {
    payload,
    shellHtml: posterFragment(payload),
  };
}
