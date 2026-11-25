import { describe, expect, it } from "vitest";
import { scanHtmlIssues } from "./scanners.js";
const numericIssues = (html: string) => scanHtmlIssues(html).filter(i => i.code === "ANIMATION_PRODUCES_NAN");
describe("numeric markup validation", () => {
  it.each([
    '<img src="data:image/png;base64,abcNaNdef">',
    '<p>NaN is a JavaScript value. Infinity is a concept.</p>',
    '<div title="NaN" data-label="NaN"></div>',
    `<div style="background:url('data:image/png;base64,NaN');content:'NaN'"></div>`,
    '<script>const value = NaN;</script><!-- <div style="left:NaNpx"> -->',
    '<div style="font-family:NaNFamily"></div>',
  ])("permits opaque resources and prose: %s", html => expect(numericIssues(html)).toEqual([]));
  it.each([
    '<div style="left:NaNpx">', "<div style='transform:translate(NaNpx,0)'>",
    '<svg><path d="M0 0 LNaN 20"/></svg>', '<svg viewBox="0 0 Infinity 20"/>',
    '<svg><circle cx=NaN r="2"/></svg>', '<style>.item{left:NaNpx}</style>',
    `<div style="background:url('data:image/png;base64,NaN');left:NaNpx">`,
    '<div style="opacity:Infinity">',
  ])("rejects invalid numeric output: %s", html => expect(numericIssues(html)).toHaveLength(1));
});
