import { afterEach, describe, expect, it, vi } from "vitest";
import { lower } from "./lower.js";
import { h, MEDIA_ELEMENT } from "./h.js";
import { Frame, Fill, Html, Image, Plate, Stack, Text, Video } from "./primitives.js";
import { Vector, vector } from "./vector.js";
import type { MediaChild, MediaElement } from "./node-types.js";
import { rememberTypography, resolveTypography } from "./typography.js";

afterEach(() => vi.unstubAllGlobals());

function observe(tree: MediaElement, medium: "html" | "svg" = "html") {
  const required = vi.fn();
  const completed = vi.fn();
  const html = lower(tree, { medium, width: 320, height: 180,
    onPurificationRequired: required, onSerializationComplete: completed });
  return { html, required, completed };
}

describe("actual serialization purification observation", () => {
  it("certifies common typed output while preserving exactly the emitted bytes", () => {
    const tree = Frame({ width: 320, height: 180, id: "scene-art" },
      Fill({ color: "#fff" }),
      Stack({ width: "fill", height: "fill", gap: 4 },
        Text({ id: "title-art", size: 12, color: "#123", weight: 500 }, '<img onerror="bad">'),
        h("div", { role: "img", title: '" quoted', tabindex: 0, "data-si-node": "subject", "aria-label": "Subject" }, "Body"),
      ),
    );
    const result = observe(tree);
    expect(result.html).toBe(lower(tree, { medium: "html", width: 320, height: 180 }));
    expect(result.html).toContain("&lt;img onerror=&quot;bad&quot;&gt;");
    expect(result.required).not.toHaveBeenCalled();
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([
    ["Html", Html({ html: '<script>alert(1)</script>' })],
    ["Code markup", h("Code", { html: '<img onerror="bad">' })],
    ["Video markup", Video({ src: "clip.mp4", html: '<svg onload="bad"/>' })],
    ["Video URL", Video({ src: "clip.mp4" })],
    ["Image URL", Image({ src: "photo.png" })],
    ["Plate URL", Plate({ src: "clip.mp4" })],
    ["script tag", h("script", null, "alert(1)")],
    ["raw p tag", h("p", null, "Content")],
    ["SVG namespace", Vector(vector.path({ d: "M0 0L10 10" }))],
    ["event attr", h("div", { onclick: "alert(1)" })],
    ["malformed attr name", h("div", { 'data-x="" onclick': "alert(1)" })],
    ["URL attr", h("div", { href: "javascript:alert(1)" })],
    ["definition attr", h("Frame", { mask: "clip" })],
  ] as const)("requires purification for %s without rewriting it", (_name, child) => {
    const tree = Frame({ width: 320, height: 180 }, child);
    const result = observe(tree);
    expect(result.html).toBe(lower(tree, { width: 320, height: 180 }));
    expect(result.required).toHaveBeenCalledTimes(1);
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("reports purification once when several emitted regions need it", () => {
    const result = observe(Frame({ width: 320, height: 180 },
      Html({ html: "<b>one</b>" }), Video({ src: "video.mp4" }), h("script", null, "bad")));
    expect(result.required).toHaveBeenCalledTimes(1);
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("classifies only emitted attribute names and still rejects SVG namespace for a plain div", () => {
    const omitted = observe(h("div", { onclick: false, arbitrary: null }));
    expect(omitted.completed).toHaveBeenCalledExactlyOnceWith(true);
    expect(observe(h("div", null, "Vector text"), "svg").completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("classifies the actual local tag when a style getter changes script to Frame", () => {
    const make = () => {
      let type = "script";
      const child: MediaElement = {
        $$typeof: MEDIA_ELEMENT,
        get type() { return type; },
        props: { get style() { type = "Frame"; return "color:red"; } },
        children: ["alert(1)"],
      };
      // A retained nested array is serialized after layout, leaving this
      // authored accessor live during serialization rather than snapshotting it.
      return { ...Frame({ width: 320, height: 180 }), children: [[child]] };
    };
    const result = observe(make());
    expect(result.html).toContain("<script");
    expect(result.html).toBe(lower(make(), { width: 320, height: 180 }));
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("certifies the emitted div when a style getter changes Frame to script after tag capture", () => {
    let type = "Frame";
    const child: MediaElement = {
      $$typeof: MEDIA_ELEMENT,
      get type() { return type; },
      props: { get style() { type = "script"; return "color:red"; } },
      children: ["Escaped <script>"],
    };
    const result = observe({ ...Frame({ width: 320, height: 180 }), children: [[child]] });
    expect(result.html).not.toContain("<script");
    expect(result.html).toContain("Escaped &lt;script&gt;");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("requires purification when a style getter changes a typed node to a raw Html branch", () => {
    let type = "Frame";
    const child: MediaElement = {
      $$typeof: MEDIA_ELEMENT,
      get type() { return type; },
      props: { get style() { type = "Html"; return "color:red"; }, html: "<script>alert(1)</script>" },
      children: [],
    };
    const result = observe({ ...Frame({ width: 320, height: 180 }), children: [[child]] });
    expect(result.html).toContain("<script>alert(1)</script>");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(["constructor", "toString", "1invalid", "bad id"])("requires purification for id %s", (id) => {
    expect(observe(Frame({ id })).completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("checks document/form membership and the actual emitted id after repeated accessor reads", () => {
    const form = { elements: {} };
    vi.stubGlobal("document", { body: {}, createElement: () => form });
    expect(observe(Frame({ id: "body" })).completed).toHaveBeenCalledExactlyOnceWith(false);
    expect(observe(Frame({ id: "elements" })).completed).toHaveBeenCalledExactlyOnceWith(false);
    expect(observe(Frame({ id: "scene-art:0" })).completed).toHaveBeenCalledExactlyOnceWith(true);
    let reads = 0;
    const props = { get id() { reads++; return reads === 3 ? "constructor" : "scene-art"; } };
    const result = observe({ $$typeof: MEDIA_ELEMENT, type: "Frame", props, children: [] });
    expect(result.html).toContain('id="constructor"');
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("rejects a late accessor value that defeats escaping rather than trusting the earlier typeof guard", () => {
    let reads = 0;
    const injected = { replace: () => 'safe" onclick="alert(1)' };
    const props = { get id(): string { reads++; return (reads === 3 ? injected : "scene-art") as unknown as string; } };
    const result = observe({ $$typeof: MEDIA_ELEMENT, type: "Frame", props, children: [] });
    expect(result.html).toContain('id="safe" onclick="alert(1)"');
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("does not signal completion after failure and supports the completion-only handshake", () => {
    const complete = vi.fn();
    expect(() => lower(h("Stack", { x: 5 }), { onSerializationComplete: complete })).toThrow();
    expect(complete).not.toHaveBeenCalled();
    lower(Text({ size: 12 }, "Safe"), { onSerializationComplete: complete });
    expect(complete).toHaveBeenCalledExactlyOnceWith(true);
    complete.mockClear();
    lower(Html({ html: "<b>raw</b>" }), { onSerializationComplete: complete });
    expect(complete).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("serializes nested array contents without invoking caller map or join", () => {
    const nested: MediaChild[] = ["safe <script>"];
    const map = vi.fn(() => ['<script>unsafe()</script>']);
    const join = vi.fn(() => '<script>unsafe()</script>');
    Object.assign(nested, { map, join });
    const tree = { ...Frame({ width: 320, height: 180 }), children: [nested] };
    const result = observe(tree);
    expect(result.html).toContain("safe &lt;script&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
    expect(map).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    expect(lower(tree, { width: 320, height: 180 })).toBe(result.html);
    expect(map).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });

  it("does not give constructor species control over nested HTML aggregation", () => {
    const species = vi.fn(() => class Poisoned extends Array {
      join() { return '<script>unsafe()</script>'; }
    });
    const nested: MediaChild[] = ["safe"];
    Object.defineProperty(nested, "constructor", { value: { get [Symbol.species]() { return species(); } } });
    const result = observe({ ...Frame({ width: 320, height: 180 }), children: [nested] });
    expect(result.html).toContain(">safe</div>");
    expect(result.html).not.toContain("<script>");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
    expect(species).not.toHaveBeenCalled();
  });

  it("escapes strings returned by an authored root layout map through the final child contract", () => {
    const children = ["safe"];
    Object.assign(children, { map: () => Object.assign(['<script>unsafe()</script>'], {
      map: () => ['<script>unsafe()</script>'], join: () => '<script>unsafe()</script>',
    }) });
    const result = observe({ ...Frame({ width: 320, height: 180 }), children });
    expect(result.html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("preserves holes and escaped ordered node/text output", () => {
    const nested: MediaChild[] = [];
    nested[1] = "One";
    nested[3] = h("div", { title: "Two" }, "Two");
    const tree = { ...Frame({ width: 320, height: 180 }), children: [nested] };
    const dense = { ...Frame({ width: 320, height: 180 }), children: [["One", h("div", { title: "Two" }, "Two")]] };
    expect(observe(tree).html).toBe(observe(dense).html);
  });

  it("escapes typography lines without caller map, join, or species aggregation", () => {
    const lines = ['Line <one>', 'Line <two>'];
    const map = vi.fn(() => ['<script>unsafe()</script>']);
    const join = vi.fn(() => '<script>unsafe()</script>');
    Object.assign(lines, { map, join });
    const text = Text({ size: 12 }, "Text");
    rememberTypography(text, { ...resolveTypography(text, 320), lines });
    const result = observe({ ...Frame({ width: 320, height: 180 }), children: [[text]] });
    expect(result.html).toContain("Line &lt;one&gt;<br>Line &lt;two&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.completed).toHaveBeenCalledExactlyOnceWith(true);
    expect(map).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });
});
