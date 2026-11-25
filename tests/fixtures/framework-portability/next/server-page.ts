//! Next App Router Server Component shape (unpublished fixture).
//! Imports @superimg/next/server — never @foxworth/superimg-interactions.

import {
  createServerPayload,
  posterHtml,
  toClientProps,
  NEXT_CLIENT_FORBIDDEN,
} from "@superimg/next/server";
import { fixtureMediaIR } from "../shared/sample-ir.js";

/** What a Server Component would compute and pass to a Client Player island. */
export function buildServerPageModel() {
  const payload = createServerPayload(fixtureMediaIR, {
    data: { title: "next fixture" },
    includeMedia: true,
  });
  const shell = posterHtml(payload);
  return {
    payload,
    posterHtml: shell,
    // Client island props — only serializable keys
    clientProps: toClientProps(payload),
  };
}

export { NEXT_CLIENT_FORBIDDEN };
