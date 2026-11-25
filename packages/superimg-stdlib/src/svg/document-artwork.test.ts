import { describe, expect, it } from "vitest";
import { SvgArtwork, svgDocument, svgDocumentIdentity, svgPart } from "./document-artwork.js";
import { createHash } from "node:crypto";
import { SaxesParser } from "saxes";
import { lower } from "../tree/lower.js";
import { visual, Instance, Scene } from "../tree/scene.js";

const bytes = (source: string) => new TextEncoder().encode(source);
describe("SVG artwork", () => {
  it("places an edited document with its original viewBox and leaves the source intact", () => {
    const input = bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 40 50"><rect id="body" width="20" height="30" fill="#f00"/></svg>');
    const doc = svgDocument(input);
    const original = doc.source;
    input[0] = 0;
    doc.source[0] = 0;
    expect(doc.source).toEqual(original);
    const first = lower(SvgArtwork({ document: doc, id: "first", width: 80, height: 100, edits: { body: { fill: "#00f" } } }), "svg");
    const second = lower(SvgArtwork({ document: doc, id: "second", width: 80, height: 100 }), "svg");
    expect(first).toContain('viewBox="-10 -20 40 50"');
    expect(svgPart("body", { document: doc }).bounds).toEqual({ x: -10, y: -20, width: 40, height: 50 });
    expect(first).toContain('fill="#00f"');
    expect(second).toContain('fill="#f00"');
  });
  it("preserves viewport alignment instead of centering or stretching imported art", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" preserveAspectRatio="xMinYMax slice"><rect width="20" height="10"/></svg>';
    const art = SvgArtwork({ document: svgDocument(bytes(source)), width: 40, height: 40 });
    for (const medium of ["svg", "html"] as const) {
      const output = lower(art, medium);
      expect(output.match(/preserveAspectRatio=/g)).toHaveLength(1);
      expect(output).toContain('preserveAspectRatio="xMinYMax slice"');
    }
    const invalid = source.replace("xMinYMax slice", "xMinYMax wobble");
    expect(() => SvgArtwork({ document: svgDocument(bytes(invalid)), width: 40, height: 40 })).toThrow(/Unsupported SVG preserveAspectRatio/);
  });
  it("refuses unsupported artwork instead of silently dropping it", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><feDiffuseLighting/></svg>'));
    expect(() => SvgArtwork({ document: doc, id: "test", width: 10, height: 10 })).toThrow(/Unsupported SVG artwork element/);
    const styled = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" fill="red"><rect width="10" height="10"/></svg>'));
    expect(() => SvgArtwork({ document: styled, width: 10, height: 10 })).toThrow(/Unsupported SVG root attribute/);
    const reserved = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" key="not-a-tree-key"/></svg>'));
    expect(() => SvgArtwork({ document: reserved, width: 10, height: 10 })).toThrow(/Unsupported SVG artwork attribute key/);
  });
  it("preserves and selects a local radial gradient for a named edit", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><radialGradient id="glow"><stop stop-color="white"/><stop offset="1" stop-color="red"/></radialGradient></defs><circle id="orb" r="4" fill="none"/></svg>'));
    const output = lower(SvgArtwork({ document: doc, id: "art", width: 10, height: 10, edits: { orb: { fill: "url(#glow)" } } }), "svg");
    expect(output).toContain('<radialGradient id="si_art_61_72_74_glow"');
    expect(output).toContain('fill="url(#si_art_61_72_74_glow)"');
  });
  it("preserves raw none-valued filter and mask attributes", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" mask="none" filter="none"/></svg>'));
    const markup = lower(SvgArtwork({ document: doc, width: 10, height: 10 }), "svg");
    expect(markup).toContain('mask="none"');
    expect(markup).toContain('filter="none"');
    expect(markup).not.toContain("url(#none)");
  });
  it("lowers xlink references without an undeclared namespace", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><path id="mark" d="M0 0L1 1"/></defs><use xlink:href="#mark"/></svg>';
    const markup = lower(SvgArtwork({ document: svgDocument(bytes(source)), id: "art", width: 10, height: 10 }), "svg");
    expect(markup).toContain('href="#si_art_61_72_74_mark"');
    expect(markup).not.toContain("xlink:href");
    expect(() => new SaxesParser({ xmlns: true }).write(markup).close()).not.toThrow();
    const duplicate = source.replace('<use xlink:href="#mark"', '<use href="#mark" xlink:href="#mark"');
    expect(() => SvgArtwork({ document: svgDocument(bytes(duplicate)), id: "art", width: 10, height: 10 })).toThrow(/cannot combine href/);
    const custom = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:custom="urn:custom" viewBox="0 0 10 10"><rect custom:value="x"/></svg>';
    expect(() => SvgArtwork({ document: svgDocument(bytes(custom)), width: 10, height: 10 })).toThrow(/Unsupported SVG artwork attribute custom:value/);
  });
  it("isolates gradients and references in repeated Scene occurrences", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="paint"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect id="body" width="10" height="10" fill="url(#paint)"/></svg>'));
    const art = visual<null>({ id: "art", render: () => ({ parts: [{ id: "body", bounds: { x: 0, y: 0, width: 10, height: 10 }, content: SvgArtwork({ document: doc, id: "local", width: 10, height: 10 }) }] }) });
    const output = lower(Scene({ id: "s", width: 40, height: 10 }, Instance({ id: "a", of: art, data: null }), Instance({ id: "b", of: art, data: null, at: { x: 20, y: 0 } })), "svg");
    const ids = [...output.matchAll(/id="(si_[^"]+paint)"/g)].map(match => match[1]!);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(output).toContain(`url(#${id})`);
    const directA = lower(SvgArtwork({ document: doc, id: "a", width: 10, height: 10 }), "svg");
    const directB = lower(SvgArtwork({ document: doc, id: "b", width: 10, height: 10 }), "svg");
    expect(directA).toContain('id="si_art_61_paint"');
    expect(directB).toContain('id="si_art_62_paint"');
    expect(() => SvgArtwork({ document: doc, width: 10, height: 10 })).toThrow(/occurrence id/);
  });
  it("separates source identity from canonical edit identity", async () => {
    const input = bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="body"/></svg>');
    const doc = svgDocument(input);
    const blue = await svgDocumentIdentity(doc, { body: { fill: "#00f" } });
    const blueAgain = await svgDocumentIdentity(doc, { body: { fill: "#00f" } });
    const red = await svgDocumentIdentity(doc, { body: { fill: "#f00" } });
    expect(blue.sourceSha256).toBe(createHash("sha256").update(input).digest("hex"));
    expect(blue).toEqual(blueAgain);
    expect(blue.sourceSha256).toBe(red.sourceSha256);
    expect(blue.revisionSha256).not.toBe(red.revisionSha256);
  });
  it("preserves patterns and filter primitives in the realized SVG", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><pattern id="p" width="2" height="2" viewBox="0 0 20 20"><circle cx="1" cy="1" r="1"/></pattern><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.2" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/><feGaussianBlur stdDeviation="1"/></filter></defs><rect width="10" height="10" fill="url(#p)" filter="url(#f)"/></svg>'));
    const markup = lower(SvgArtwork({ document: doc, id: "test", width: 10, height: 10 }), "svg");
    expect(markup).toContain("<pattern");
    expect(markup).toContain('viewBox="0 0 20 20"');
    expect(markup).toContain('<feTurbulence type="fractalNoise" baseFrequency="0.2" result="noise"');
    expect(markup).toContain('<feDisplacementMap in="SourceGraphic" in2="noise" scale="2"');
    expect(markup).toContain('<feGaussianBlur stdDeviation="1"');
    expect(markup).toContain('filter="url(#si_art_74_65_73_74_f)"');
  });
  it("selects a named part while retaining ancestor transforms and definitions", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="paint"/></defs><g transform="translate(2 3)"><rect id="chosen" fill="url(#paint)"/><circle id="other" r="2"/></g></svg>'));
    const markup = lower(SvgArtwork({ document: doc, id: "part", only: "chosen", width: 10, height: 10 }), "svg");
    expect(markup).toContain('transform="translate(2 3)"');
    expect(markup).toContain("<linearGradient");
    expect(markup).toContain("<rect");
    expect(markup).not.toContain("<circle");
    expect(() => SvgArtwork({ document: doc, id: "part", only: "absent", width: 10, height: 10 })).toThrow(/Unknown SVG part/);
  });
  it("scopes accessibility references alongside their target IDs", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title id="title">A</title><desc id="description">B</desc><rect aria-labelledby="title description" width="10" height="10"/></svg>'));
    const markup = lower(SvgArtwork({ document: doc, id: "art", width: 10, height: 10 }), "svg");
    expect(markup).toContain('aria-labelledby="si_art_61_72_74_title si_art_61_72_74_description"');
    expect(() => svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg"><rect aria-describedby="missing"/></svg>'))).toThrow(/Unresolved SVG reference/);
  });
  it("serializes edited text as text and scopes an edited paint reference", () => {
    const doc = svgDocument(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="paint"/></defs><rect id="body"/><text id="label">old</text></svg>'));
    const markup = lower(SvgArtwork({ document: doc, id: "art", width: 10, height: 10, edits: { body: { fill: "url(#paint)" }, label: { text: "A & <B>" } } }), "svg");
    expect(markup).toContain('fill="url(#si_art_61_72_74_paint)"');
    expect(markup).toContain("A &amp; &lt;B&gt;");
    expect(markup).not.toContain(">old<");
  });
});
