import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { NodeEditEngine, compileNodeEditableSource, previewNodeEdit } from "@foxworth/superimg-interactions";

it("pairs revision identities, retains both sides, and never writes source", async () => {
  const root = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), ".revision-"));
  const source = `import { video, Frame, Text, Fill } from "@foxworth/superimg"; import { copy } from "./copy";
export default video({size:{width:320,height:180},fps:10,duration:"2s",sample:{frames:20},variants:{long:{frames:40}},resolve:({data})=>({duration:data.frames+"f"}),render:()=>Frame({id:"title",x:10,y:20,width:200,height:80},Fill({color:"white"}),Text({color:"black"},copy))});`;
  try {
    await writeFile(join(root,"copy.ts"),`export const copy="Original";`);
    await writeFile(join(root,"test.media.ts"),source);
    const engine = new NodeEditEngine({projectRoot:root,compileSource:args=>compileNodeEditableSource(root,args)});
    const b = await engine.bindings("test.media.ts",{});
    const x=b.manifest.bindings.find(v=>v.propertyPath==="initial.transform.x")!;
    const y=b.manifest.bindings.find(v=>v.propertyPath==="initial.transform.y")!;
    const preview=await previewNodeEdit(engine,{schemaVersion:0,source:"test.media.ts",kind:"set-node-transform",target:{nodeId:x.targetId,xBindingId:x.bindingId,yBindingId:y.bindingId},value:{x:60,y:30},expected:{intentHash:b.manifest.intentHash,sourceHashes:{...b.sourceHashes}}},{},{targets:["320x180.html"],adapter:{defaultFonts:false}});
    try {
      expect(preview.report.before.inputDigest).not.toBe(preview.report.after.inputDigest);
      expect(await readFile(join(root,"test.media.ts"),"utf8")).toBe(source);
      await writeFile(join(root,"test.media.ts"),source.replace("x:10","x:99"));
      await writeFile(join(root,"copy.ts"),`export const copy="Later";`);
      const rows=await preview.compare(5,"html");
      expect(rows).toHaveLength(2);
      expect(new TextDecoder().decode(rows[0]!.before!.bytes)).toContain("Original");
      expect(new TextDecoder().decode(rows[0]!.after!.bytes)).toContain("Original");
      expect(rows[0]!.before!.bytes).not.toEqual(rows[0]!.after!.bytes);
      expect(await readFile(join(root,"test.media.ts"),"utf8")).toContain("x:99");
      const later = await preview.compare(25,"html");
      expect(later.find(r=>r.coordinates.variantId==="default")).toMatchObject({before:null,after:null});
      expect(later.find(r=>r.coordinates.variantId==="long")?.before).not.toBeNull();
      expect((await preview.compare(100,"html")).every(r=>r.before===null&&r.after===null)).toBe(true);
    } finally {await preview.dispose();}
    await expect(preview.compare(0)).rejects.toThrow(/disposed/);
  } finally {await rm(root,{recursive:true,force:true});}
});
