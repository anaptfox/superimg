import type { CompositionEntryData, JsonObject } from "@foxworth/superimg";

export type Entry = CompositionEntryData & {
  id: string;
  uses: Record<string, JsonObject>;
};
