import { compose } from "superimg";
import intro from "./intro.video.js";
import content from "./content.video.js";
import outro from "./outro.video.js";

export default compose([intro, content, outro], {
  brandName: "Acme Corp",
});
