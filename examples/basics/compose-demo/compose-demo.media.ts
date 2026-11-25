// One film in three scenes: first light → midday → dusk.
// Each scene is its own media program with its own director. sequence() keeps
// those named occurrences, then time() selects the shared delivery clock.
// The shared horizon and the sun's arc carry across the cuts, so the joins
// read as time passing rather than slides changing.

import { sequence, time } from "@foxworth/superimg";
import intro from "./intro.media.js";
import content from "./content.media.js";
import outro from "./outro.media.js";

const size = { width: 1920, height: 1080 };
const fps = 30;

export default time(sequence([
  { id: "first-light", content: intro },
  { id: "midday", content },
  { id: "dusk", content: outro },
]), { size, fps });
