import { describe, expect, it } from "vitest";
import { Frame, Fill, Text, Vector, vector, Html, walkMediaTree } from "@superimg/stdlib/tree";
import { scanTreePaintIssues, stageBackground } from "./tree-paint.js";
import type { PaintScanNode } from "./tree-paint.js";

describe("scanTreePaintIssues", () => {
  it("flags text with no stage Fill", () => {
    const issues = scanTreePaintIssues(
      [{ tag: "Text", role: "Text", color: "#111827" }],
      { frame: 0, progress: 0 },
    );
    expect(issues.some((issue) => issue.code === "UNPAINTED_STAGE")).toBe(true);
  });

  it("flags ink on a near-black fill", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#07070c" } },
      { tag: "Text", role: "Text", id: "title", color: "#111827" },
    ];
    const issues = scanTreePaintIssues(nodes, { frame: 0, progress: 0 });
    expect(issues.some((issue) => issue.code === "LOW_CONTRAST_TEXT")).toBe(true);
  });

  it("allows ink on paper", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" } },
      { tag: "Text", role: "Text", color: "#111827" },
    ];
    expect(scanTreePaintIssues(nodes, { frame: 0, progress: 0 })).toEqual([]);
  });

  it("flags sparse ink on a square stage", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" }, layout: { x: 0, y: 0, width: 1080, height: 1080 } },
      {
        tag: "Text",
        role: "Text",
        color: "#111827",
        layout: { x: 480, y: 520, width: 120, height: 24 },
      },
    ];
    const issues = scanTreePaintIssues(nodes, { frame: 0, progress: 0, width: 1080, height: 1080 });
    expect(issues.some((issue) => issue.code === "SPARSE_FOCAL")).toBe(true);
  });

  it("allows a filled square focal", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" }, layout: { x: 0, y: 0, width: 1080, height: 1080 } },
      { tag: "Fill", paint: { fill: "#111827" }, layout: { x: 80, y: 120, width: 920, height: 840 } },
      { tag: "Text", role: "Text", color: "#111827", layout: { x: 100, y: 140, width: 800, height: 64 } },
    ];
    const issues = scanTreePaintIssues(nodes, { frame: 0, progress: 0, width: 1080, height: 1080 });
    expect(issues.some(issue => issue.code === "SPARSE_FOCAL")).toBe(false);
  });

  it("treats a config background as a painted stage and contrast floor", () => {
    const nodes: PaintScanNode[] = [{ tag: "Text", role: "Text", color: "#F4F1EA" }];
    expect(scanTreePaintIssues(nodes, { frame: 0, progress: 0, background: "#12100E" })).toEqual([]);
    const dark = scanTreePaintIssues(
      [{ tag: "Text", role: "Text", color: "#111827" }],
      { frame: 0, progress: 0, background: "#12100E" },
    );
    expect(dark.some((issue) => issue.code === "UNPAINTED_STAGE")).toBe(false);
    expect(dark.some((issue) => issue.code === "LOW_CONTRAST_TEXT")).toBe(true);
  });

  it("paints a non-color background without using it as the contrast floor", () => {
    const nodes: PaintScanNode[] = [{ tag: "Text", role: "Text", color: "#111827" }];
    for (const background of ["linear-gradient(#000,#fff)", "image", "  "]) {
      const issues = scanTreePaintIssues(nodes, { frame: 0, progress: 0, background });
      expect(issues.some((issue) => issue.code === "LOW_CONTRAST_TEXT"), background).toBe(false);
      expect(issues.some((issue) => issue.code === "UNPAINTED_STAGE"), background).toBe(background.trim().length === 0);
    }
    expect(stageBackground("  #12100E  ")).toBe("#12100E");
    expect(stageBackground("   ")).toBeUndefined();
    expect(stageBackground({ src: "https://cdn.example/bg.png" })).toBe("image");
    expect(stageBackground({ src: "  " })).toBeUndefined();
  });

  it("keeps a full-bleed Fill as the contrast floor over the config background", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" }, layout: { x: 0, y: 0, width: 100, height: 100 } },
      { tag: "Text", role: "Text", color: "#111827" },
    ];
    expect(scanTreePaintIssues(nodes, {
      frame: 0,
      progress: 0,
      width: 100,
      height: 100,
      background: "#111827",
    })).toEqual([]);
  });

  it("uses the config background as the floor when the Fill is not full-bleed", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" }, layout: { x: 0, y: 0, width: 10, height: 10 } },
      { tag: "Text", role: "Text", color: "#111827" },
    ];
    const issues = scanTreePaintIssues(nodes, {
      frame: 0,
      progress: 0,
      width: 100,
      height: 100,
      background: "#12100E",
    });
    expect(issues.some((issue) => issue.code === "LOW_CONTRAST_TEXT")).toBe(true);
    expect(issues.some((issue) => issue.code === "UNPAINTED_STAGE")).toBe(false);
  });

  it("does not apply SPARSE_FOCAL to landscape stages", () => {
    const nodes: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#F4F1EA" }, layout: { x: 0, y: 0, width: 1920, height: 1080 } },
      { tag: "Text", role: "Text", color: "#111827", layout: { x: 40, y: 40, width: 120, height: 24 } },
    ];
    expect(
      scanTreePaintIssues(nodes, { frame: 0, progress: 0, width: 1920, height: 1080 }),
    ).toEqual([]);
  });
  it("counts transformed painted vector bounds rather than its full-stage container", () => {
    const tree = (scale: number) => Frame({width:1080,height:1080},Fill({color:'#fff'}),
      Vector({width:1080,height:1080,viewBox:{x:0,y:0,width:1080,height:1080}},
        vector.group({transform:{x:300,y:200,scale}},vector.path({d:'M0 0H100V120H0Z',fill:'#222'}))),
      Text({size:12,color:'#222'},'Mark'));
    const scan = (scale: number) => scanTreePaintIssues(walkMediaTree(tree(scale),{width:1080,height:1080}),{frame:0,progress:0,width:1080,height:1080});
    expect(scan(5).some(x=>x.code==='SPARSE_FOCAL')).toBe(false);
    expect(scan(.1).some(x=>x.code==='SPARSE_FOCAL')).toBe(true);
  });

  it("does not count definition geometry, hidden groups, or unpainted paths as focal ink", () => {
    const tree = Frame({width:1080,height:1080},Fill({color:'#fff'}),
      Vector({width:1080,height:1080,viewBox:{x:0,y:0,width:1080,height:1080}},
        vector.defs(vector.clip({id:'large-clip'},vector.path({d:'M0 0H1000V1000H0Z',fill:'white'}))),
        vector.group({opacity:0},vector.path({d:'M0 0H1000V1000H0Z',fill:'#222'})),
        vector.path({d:'M0 0H1000V1000H0Z',fill:'none'}),
        vector.path({d:'M0 0H1000V1000H0Z',fill:'#222',opacity:0})),
      Text({size:12,color:'#222'},'Mark'));
    const issues=scanTreePaintIssues(walkMediaTree(tree,{width:1080,height:1080}),{frame:0,progress:0,width:1080,height:1080});
    expect(issues.some(x=>x.code==='SPARSE_FOCAL')).toBe(true);
  });

  it("rejects offstage vector art and does not multiply overlapping tiny paths", () => {
    const base: PaintScanNode[] = [{tag:'Fill',paint:{fill:'#fff'},layout:{x:0,y:0,width:1080,height:1080}},
      {tag:'Text',layout:{x:20,y:20,width:80,height:15},color:'#222'}];
    const tiny = Array.from({length:100},()=>({tag:'VectorPath',paint:{fill:'#222'},bounds:{x:500,y:500,width:40,height:40}}));
    const offstage = {tag:'VectorPath',paint:{fill:'#222'},bounds:{x:2000,y:2000,width:1000,height:1000}};
    expect(scanTreePaintIssues([...base,...tiny,offstage],{frame:0,progress:0,width:1080,height:1080}).some(x=>x.code==='SPARSE_FOCAL')).toBe(true);
  });

  it("reports unknown focal coverage for a visible opaque world instead of declaring its interior empty", () => {
    const tree = Frame({ width: 1080, height: 1080 }, Fill({ color: "#fff" }),
      Html({ id: "world", width: 1080, height: 1080, html: "<canvas></canvas>" }),
      Text({ size: 12, color: "#222" }, "Caption"));
    const issues = scanTreePaintIssues(walkMediaTree(tree, { width: 1080, height: 1080 }), { frame: 0, progress: 0, width: 1080, height: 1080 });
    expect(issues.some(issue => issue.code === "SPARSE_FOCAL")).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ code: "FOCAL_COVERAGE_UNVERIFIED", severity: "warning", details: expect.objectContaining({ opaqueRegions: 1 }) }));
  });

  it("still rejects sparse native ink when opaque boxes are tiny, offstage or hidden", () => {
    const base: PaintScanNode[] = [
      { tag: "Fill", paint: { fill: "#fff" }, layout: { x: 0, y: 0, width: 1080, height: 1080 } },
      { tag: "Text", color: "#222", layout: { x: 20, y: 20, width: 80, height: 15 } },
    ];
    for (const opaque of [
      { tag: "Html", layout: { x: 20, y: 50, width: 40, height: 40 } },
      { tag: "Html", layout: { x: 2000, y: 0, width: 1080, height: 1080 } },
      { tag: "Html", paint: { opacity: 0 }, layout: { x: 0, y: 0, width: 1080, height: 1080 } },
    ]) {
      const issues = scanTreePaintIssues([...base, opaque], { frame: 0, progress: 0, width: 1080, height: 1080 });
      expect(issues.some(issue => issue.code === "SPARSE_FOCAL")).toBe(true);
      expect(issues.some(issue => issue.code === "FOCAL_COVERAGE_UNVERIFIED")).toBe(false);
    }
    const issues = scanTreePaintIssues([...base,
      { tag: "Frame", path: "0.1", paint: { opacity: 0 } },
      { tag: "Html", path: "0.1.0", layout: { x: 0, y: 0, width: 1080, height: 1080 } },
    ], { frame: 0, progress: 0, width: 1080, height: 1080 });
    expect(issues.some(issue => issue.code === "SPARSE_FOCAL")).toBe(true);
  });

  it("checks inherited SVG text paint while disclosing native run and stroke uncertainty", () => {
    const scan = (text: ReturnType<typeof vector.text>) => scanTreePaintIssues(walkMediaTree(Vector({ width: 320, height: 180 }, vector.group({ fill: "#111111", stroke: "#ffffff", strokeWidth: 2 }, text)), { width: 320, height: 180 }), { frame: 0, progress: 0, width: 320, height: 180, background: "#111111" });
    expect(scan(vector.text({ x: 10, y: 30, fill: "none" }, "Caption"))).toContainEqual(expect.objectContaining({ code: "TEXT_PAINT_UNVERIFIED" }));
    const plain = walkMediaTree(Vector({ width: 320, height: 180 }, vector.group({ fill: "#111111" }, vector.text({ id: "caption", x: 10, y: 30 }, "Caption"))), { width: 320, height: 180 });
    expect(scanTreePaintIssues(plain, { frame: 0, progress: 0, width: 320, height: 180, background: "#111111" })).toContainEqual(expect.objectContaining({ code: "LOW_CONTRAST_TEXT", nodeId: "caption" }));
    const runs = walkMediaTree(Vector({ width: 320, height: 180 }, vector.text({ x: 10, y: 30, fill: "#111111" }, "A", vector.run({ fill: "#ffffff" }, "B"))), { width: 320, height: 180 });
    const issues = scanTreePaintIssues(runs, { frame: 0, progress: 0, width: 320, height: 180, background: "#111111" });
    expect(issues.some(issue => issue.code === "LOW_CONTRAST_TEXT")).toBe(false);
    expect(issues.some(issue => issue.code === "TEXT_PAINT_UNVERIFIED")).toBe(true);
  });

});
