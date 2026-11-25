//! Next Client Component shape (unpublished fixture).
//! Only browser/player/next client — forbidden list is asserted in tests.

import type { SerializableMediaPayload } from "@superimg/next";

export interface ClientPlayerIslandProps {
  payload: Pick<
    SerializableMediaPayload,
    "schemaVersion" | "sourceId" | "poster" | "media" | "data"
  >;
}

/**
 * Stand-in for a "use client" Player mount.
 * Real apps use MediaPlayerIsland / Player from @superimg/next/client.
 */
export function clientPlayerIslandProps(
  props: ClientPlayerIslandProps,
): ClientPlayerIslandProps {
  return props;
}

export const CLIENT_ENTRY_IMPORTS = [
  "@superimg/next/client",
] as const;
