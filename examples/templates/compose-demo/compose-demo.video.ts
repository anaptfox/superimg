import { compose, scene } from "superimg";
import intro from "./intro.video.js";
import content from "./content.video.js";
import outro from "./outro.video.js";

export default compose([
  intro,
  scene(content, { data: { brandName: "Acme Corp" } }),
  outro,
]);
