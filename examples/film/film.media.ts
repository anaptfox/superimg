import { film } from "@foxworth/superimg/film";
import script from "./film.script.md";
import { lighthouse } from "./series";
import * as shots from "./shots";

export default film({ ...lighthouse, script, shots: [shots] });
