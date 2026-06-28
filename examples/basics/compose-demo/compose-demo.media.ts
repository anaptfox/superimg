import { compose, scene } from "superimg";
import intro from "./intro.media.js";
import content from "./content.media.js";
import outro from "./outro.media.js";

export default compose([
  intro,
  scene(content, { sample: { brandName: "Acme Corp" } }),
  outro,
]);
