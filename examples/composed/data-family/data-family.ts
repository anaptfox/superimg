import { sequence } from "@foxworth/superimg";
import card from "./parts/card.media.js";

// The same authored source is used twice. Each occurrence has its own data and
// resolve result; a collection entry can override both by qualified path.
export const program = sequence([
  { id: "first", content: card, data: { label: "FIRST", color: "#78c9b0" } },
  { id: "second", content: card, data: { label: "SECOND", color: "#f2b35f" } },
]);
