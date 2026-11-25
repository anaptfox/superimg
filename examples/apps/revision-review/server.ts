//! Trusted loopback development host. Preview identity is never edit authority.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { compileNodeEditableSource, NodeEditEngine, previewNodeEdit } from "@foxworth/superimg-node/edit";
import { prepareNodeMediaExport, type PreparedNodeMediaExport } from "@foxworth/superimg-interactions";
import { collection } from "@foxworth/superimg";
import { compileTemplate } from "@superimg/core";
import { evaluateReviewAssertions, observeReviewBeat } from "@foxworth/superimg/review";
import type { MediaEditCommand, DeterministicMediaValue } from "@superimg/types";
import review from "./launch.review.js";
import type { LaunchData } from "./launch.media.js";

const root = dirname(fileURLToPath(import.meta.url));
const source = "launch.media.ts";
const targets = ["960x540.png", "540x540.png"];
const adapter = { defaultFonts: false as const };
const revision = async () => createHash("sha256").update(await readFile(join(root, source))).digest("hex");
const imageHtml = (bytes: Uint8Array) => `<!doctype html><html><body style="margin:0;background:#f2efe7"><img alt="Captured authored frame" style="display:block;width:100%;height:auto" src="data:image/png;base64,${Buffer.from(bytes).toString("base64")}"></body></html>`;
const checks = (width: number, height: number, data: Record<string, unknown>) => {
  const observed = observeReviewBeat(review, { width,height,data,frame:25,seconds:1,timelineSeconds:(25/149)*6,progress:25/149,fps:25 });
  return { origin:"author-reported", visual:"unreviewed", results:evaluateReviewAssertions(review.checks,"hold",observed.observation) };
};

export function revisionReviewPlugin(): Plugin {
  const engine = new NodeEditEngine({ projectRoot: root, compileSource: args => compileNodeEditableSource(root,args) });
  let batch: PreparedNodeMediaExport | undefined;
  let busy = false;
  let lastPlan: Awaited<ReturnType<typeof engine.plan>> | undefined;
  let lastInverse: MediaEditCommand | undefined;
  let batchRevision: string | undefined;
  let batchAccepted = false;
  async function load() {
    const compilation = await compileNodeEditableSource(root, { source, context:{} });
    if (!compilation.programCode) throw new Error("Executable source unavailable");
    const c = compileTemplate(compilation.programCode);
    if (c.error) throw c.error;
    if (!c.media) throw new Error("Expected deterministic media");
    const data=c.media.sample;
    if(!data || typeof data.id!=="string" || typeof data.title!=="string" || typeof data.description!=="string" || typeof data.productAvailable!=="boolean") throw new Error("Launch source must supply complete launch data");
    return { compilation, media:c.media as unknown as DeterministicMediaValue<LaunchData> };
  }
  async function titleCommand(value: {x:number;y:number}, expectedRevision: string) {
    if (expectedRevision !== await revision()) throw new Error("Source changed; inspect again before editing");
    const b = await engine.bindings(source,{});
    const x = b.manifest.bindings.find(v=>v.targetId.endsWith("::title") && v.propertyPath === "initial.transform.x" && v.capability === "exact");
    const y = b.manifest.bindings.find(v=>v.targetId===x?.targetId && v.propertyPath === "initial.transform.y" && v.capability === "exact");
    if (!x || !y) throw new Error("Title no longer has two exact coordinate bindings");
    return {schemaVersion:0,source,kind:"set-node-transform",target:{nodeId:x.targetId,xBindingId:x.bindingId,yBindingId:y.bindingId},value,expected:{intentHash:b.manifest.intentHash,sourceHashes:{...b.sourceHashes}}} satisfies MediaEditCommand;
  }
  return { name:"superimg-revision-review",
    configureServer(server) {
      server.httpServer?.once("close",()=>{ void batch?.dispose(); });
      server.middlewares.use(async (req,res,next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const send = (status:number,value:unknown) => {res.statusCode=status;res.setHeader("content-type","application/json");res.end(JSON.stringify(value));};
        const origin = `http://${req.headers.host}`;
        let local = false;
        try { local = ["127.0.0.1","localhost","[::1]"].includes(new URL(origin).hostname); } catch {}
        // Host admission on every request; neither command nor preview possession bypasses it.
        if (req.method!=="POST" || !local || req.headers.origin!==origin || req.headers["x-superimg-revision"]!=="1") return send(403,{message:"This local host requires a same-origin admitted request"});
        if (busy) return send(409,{message:"A host operation is already running"});
        busy=true;
        let effectAttempted=false;
        try {
          let body="";
          for await (const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>32_768)throw new Error("Request exceeds limit");}
          const input=JSON.parse(body || "{}");
          const action=req.url.split("?")[0];
          if (action==="/api/inspect") {
            const current=await revision();
            const {media}=await load();
            const prepared=await prepareNodeMediaExport(media,{for:targets,at:1},adapter);
            try {
              const row=prepared.matrix.find(r=>r.coordinates.editionId===(input.editionId || "default"));
              if(!row)throw new Error("Edition not prepared");
              const sample=await prepared.sample(row.coordinates,"25f");
              const bindings=await engine.bindings(source,{});
              const xs=bindings.manifest.bindings.find(b=>b.targetId.endsWith("::title")&&b.propertyPath.endsWith(".x"));
              const ys=bindings.manifest.bindings.find(b=>b.targetId===xs?.targetId&&b.propertyPath.endsWith(".y"));
              if(current!==await revision())throw new Error("Source changed during inspection");
              return send(200,{revision:current,html:imageHtml(sample.bytes),parts:[
                {id:"title",label:"Title / source coordinates",editable:!input.editionId&&xs?.capability==="exact"&&ys?.capability==="exact",value:{x:xs?.value,y:ys?.value},reason:input.editionId?"Square layout is inspect-only; these bindings describe the default edition.":"Literal default-edition title coordinates; source inspection, not DOM measurement."},
                {id:"product",label:"Product / computed geometry",editable:false,reason:"Product placement is computed by launchLayout; arbitrary expressions are inspect-only."},
              ],checks:checks(row.canvas.width,row.canvas.height,{...media.sample})});
            } finally {await prepared.dispose();}
          }
          if(action==="/api/preview") {
            if(input.editionId || input.command?.partId!=="title" || input.command?.kind!=="set-node-transform")throw new Error("Only the exact default-edition title transform is editable");
            const {x,y}=input.command.value ?? {};
            if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1920||Math.abs(y)>1080)throw new Error("Invalid title coordinates");
            const command=await titleCommand({x,y},input.command.sourceRevision);
            const candidate=await previewNodeEdit(engine,command,{}, {targets,adapter});
            try {
              const rows=await candidate.compare(25);
              const row=rows.find(r=>r.coordinates.editionId==="default");
              if(!row?.before||!row.after)throw new Error("Comparison frame is absent");
              return send(200,{state:"proposed",sourceRevision:input.command.sourceRevision,command,beforeHtml:imageHtml(row.before.bytes),afterHtml:imageHtml(row.after.bytes),changes:candidate.report,checks:{visual:"unreviewed",captures:rows.map(r=>({coordinates:r.coordinates,frame:r.frame,basis:r.basis,before:r.before?"captured":"absent",after:r.after?"captured":"absent"}))}});
            } finally {await candidate.dispose();}
          }
          if(action==="/api/apply") {
            const command=input.command as MediaEditCommand;
            if(command?.source!==source||command.kind!=="set-node-transform"||!command.target.nodeId.endsWith("::title"))throw new Error("Edit outside this host's admitted capability");
            if(!Number.isFinite(command.value.x)||!Number.isFinite(command.value.y)||Math.abs(command.value.x)>1920||Math.abs(command.value.y)>1080)throw new Error("Invalid title coordinates");
            lastPlan=await engine.plan(command,{});
            effectAttempted=true;
            const result=await engine.apply(lastPlan,{});
            const verified=await engine.verify(lastPlan,result,{});
            if(!verified.ok) return send(409,{certainty:"unknown",message:verified.message});
            lastInverse=result.transaction.inverse;
            return send(200,{transaction:result.transaction,verification:verified,visual:"unreviewed"});
          }
          if(action==="/api/reconcile")return send(200,lastPlan?await engine.reconcile(lastPlan,{}):{status:"not-started"});
          if(action==="/api/undo") {
            if(!lastInverse)throw new Error("No inverse available");
            lastPlan=await engine.plan(lastInverse,{});
            effectAttempted=true;
            const result=await engine.apply(lastPlan,{});
            const verified=await engine.verify(lastPlan,result,{});
            if(!verified.ok)return send(409,{certainty:"unknown",message:verified.message});
            lastInverse=undefined;
            return send(200,{transaction:result.transaction,verification:verified});
          }
          if(action==="/api/batch/rehearse") {
            await batch?.dispose();batch=undefined;batchAccepted=false;
            batchRevision=await revision();
            const {media}=await load();
            const entries: (LaunchData & {id:string})[]=[{...media.sample!,id:"normal"},{...media.sample!,id:"long-title",title:input.corrected ? "Good work starts here." : "A much longer title to review at both delivery sizes"},{...media.sample!,id:"missing-photo",productAvailable:input.corrected===true}];
            batch=await prepareNodeMediaExport(collection({entries,media}),{for:targets,at:1},adapter);
            const results=[];
            for(const r of batch.matrix) {
              await batch.sample(r.coordinates,"25f");
              results.push({coordinates:r.coordinates,...checks(r.canvas.width,r.canvas.height,{...entries.find(e=>e.id===r.coordinates.entryId)})});
            }
            batchAccepted=!results.some(r=>r.results.some(c=>c.status==="fail"));
            return send(200,{exportable:batchAccepted,digest:batch.digest,matrix:batch.matrix,coverage:{planned:batch.matrix.length,captured:results.length,frames:[25],visual:"unreviewed",inputs:"declared-resources"},results});
          }
          if(action==="/api/batch/export") {
            if(!batch || !batchAccepted)throw new Error("Prepare a corrected batch with no failed authored checks first");
            if(batchRevision!==await revision())throw new Error("Source changed; explicitly prepare another batch");
            const bundle=await batch.export();
            try {
              // Example files are host-owned unpublished downloads, not a durable publication receipt.
              const directory=join(root,"output","rehearsal",batch.digest);
              effectAttempted=true;
              await mkdir(directory,{recursive:true});
              for(const artifact of bundle.artifacts){const target=join(directory,artifact.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,await artifact.bytes());}
              return send(200,{state:"exported",preparedDigest:batch.digest,artifacts:bundle.artifacts.map(a=>({path:a.path,mimeType:a.mimeType,sha256:a.sha256})),directory,visual:"unreviewed",publication:"not-published"});
            }finally{await bundle.dispose();}
          }
          return send(404,{message:"Unknown host operation"});
        } catch(e) {const unknown=effectAttempted||(e as {certainty?:string}).certainty==="unknown";return send(unknown?409:400,{certainty:unknown?"unknown":"completed",message:e instanceof Error?e.message:String(e)});}
        finally {busy=false;}
      });
    },
  };
}
