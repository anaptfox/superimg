import * as esbuild from "esbuild";
import * as acorn from "acorn";
const code = `
import { compose } from "superimg";
import intro from "./intro.video.js";
import content from "./content.video.js";
import outro from "./outro.video.js";

export default compose([intro, content, outro]);
`;
async function run() {
  const { code: transformed } = await esbuild.transform(code, { loader: "ts", target: "esnext" });
  const ast = acorn.parse(transformed, { sourceType: "module", ecmaVersion: "latest" });
  console.log(JSON.stringify(ast, null, 2));
}
run();
