import { collection, time } from "@foxworth/superimg";
import { program } from "../data-family.js";
import { loadEntries } from "./entries.server";
import type { Entry } from "./entry.js";

export default collection({
  entries: loadEntries,
  media: time<Entry>(program, {
    size: { width: 1280, height: 720 },
    fps: 25,
  }),
});
