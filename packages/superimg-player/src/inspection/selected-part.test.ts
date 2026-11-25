import { describe, expect, it } from "vitest";
import { describeSelectedPart, selectedPartTransform, type SelectedPartCompilation } from "./selected-part.js";
import type { PreviewSnapshot } from "./types.js";

const coordinates = { sourceId: "launch", variantId: "default", editionId: "default" };
const compilation: SelectedPartCompilation = { source: "launch.media.ts", sourceRevision: "revision-1", surfaceId: "preview", generation: 2, presentedRevision: 3,
  coordinates, acceptedCoordinates: coordinates, sourceHashes: { "launch.media.ts": "source-hash" },
  manifest: { schemaVersion: 0, coordinates, intentHash: "intent-hash", summary: { exactBindingCount: 2, inspectOnlyCount: 0, opaqueCount: 0 },
    bindings: ["x", "y"].map(axis => ({ schemaVersion: 0, bindingId: `default::title#initial.transform.${axis}`, targetId: "default::title", propertyPath: `initial.transform.${axis}`, capability: "exact", value: 10 })) },
};
const snapshot: PreviewSnapshot = { schemaVersion: 1, width:100,height:80,fps:25,totalFrames:50,requestedFrame:25,clock:{owner:"inspection",isPlaying:false},currentPart:null,parts:[],routes:{},activeOccurrences:[],stepId:null,semantic:null,geometry:{coordinateSpace:"host-viewport",iframePath:[],dpr:1,surface:{x:0,y:0,width:100,height:80},frame:null},coverage:{dom:"measured",opaque:[]},surfaceId: "preview", source: { id: "launch", revision: "revision-1" }, generation: 2, presented: { frame: 25, revision: 3 }, disposed: false,
  readiness: { status: "ready", error: null }, nodes: [{ id: "title", occurrence: null, sceneId: "default", kind: "Frame", actions: [], bounds: { x: 0,y:0,width:20,height:20 }, authoredBounds: null }] };
const inspect = (s = snapshot, c = compilation) => describeSelectedPart({ snapshot: s, target: { id: "title", occurrence: null }, compilation: c });
describe("selected part evidence join", () => {
  it("constructs existing exact commands without executing or granting authority", () => {
    expect(selectedPartTransform(inspect(), { x: 15,y:20 })).toMatchObject({ kind: "set-node-transform", source: "launch.media.ts", expected: { intentHash: "intent-hash" }, value: { x:15,y:20 } });
  });
  it("refuses stale source, accepted revision, generation, readiness and coordinates", () => {
    for (const s of [ { ...snapshot, source: { id:"other", revision:"revision-1" } }, { ...snapshot, generation: 3 }, { ...snapshot, source: { id:"launch", revision:"old" } }, { ...snapshot, presented: {frame:25,revision:4} }, { ...snapshot, readiness: {status:"pending",error:null} } ] as PreviewSnapshot[]) expect(inspect(s).state).toBe("inspect-only");
    expect(inspect(snapshot, { ...compilation, acceptedCoordinates: {...coordinates, editionId:"square"} }).reason).toBe("coordinate-mismatch");
  });
  it("does not guess between ambiguous identities or treat computed values as exact", () => {
    expect(inspect({...snapshot,nodes:[...snapshot.nodes,...snapshot.nodes]}).reason).toBe("ambiguous-target");
    const c = { ...compilation, manifest:{...compilation.manifest, bindings: compilation.manifest.bindings.map(b=>({...b,capability:"inspect-only" as const,reason:"expression-binding" as const}))} };
    expect(() => selectedPartTransform(inspect(snapshot,c),{x:1,y:2})).toThrow();
    expect(inspect({...snapshot,nodes:[]}).reason).toBe("missing-target");
  });
});
