import * as acorn from "acorn";
const ast = acorn.parse("export default compose([intro, content, outro]);", { sourceType: "module", ecmaVersion: "latest" });
console.log(JSON.stringify(ast.body[0].declaration, null, 2));
