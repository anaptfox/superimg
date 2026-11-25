import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isMediaElement,
  isRenderOutput,
  MEDIA_ELEMENT,
  type MediaAttributes,
  type MediaChild,
  type MediaElement,
  type MediaNode,
  type MediaProps,
  type RenderOutput,
} from "../media-node.js";

describe("media-node", () => {
  it("rejects plain objects", () => {
    expect(isMediaElement({ type: "div" })).toBe(false);
    expect(isMediaElement("<div/>")).toBe(false);
    expect(isRenderOutput("<div/>")).toBe(false);
    expect(MEDIA_ELEMENT).toBe("@foxworth/superimg/element");
  });

  it("retains literal element and prop types", () => {
    type PathProps = MediaProps & { d: string; strokeWidth?: number };
    const node: MediaElement<"VectorPath", PathProps> = {
      $$typeof: MEDIA_ELEMENT,
      type: "VectorPath",
      props: { d: "M0 0 L10 10", strokeWidth: 2 },
      children: [],
    };
    expectTypeOf(node.type).toEqualTypeOf<"VectorPath">();
    expectTypeOf(node.props.d).toEqualTypeOf<string>();
    expect(isMediaElement(node)).toBe(true);
  });

  it("allows string children without widening roots back to strings", () => {
    const child: MediaChild = "Hello";
    const node: MediaNode = {
      $$typeof: MEDIA_ELEMENT,
      type: "Text",
      props: {},
      children: [child],
    };
    const output: RenderOutput = node;
    expect(output.children).toEqual(["Hello"]);

    if (false) {
      // @ts-expect-error raw markup is not a valid render root
      const rawRoot: RenderOutput = "<p>Hello</p>";
      expect(rawRoot).toBeDefined();
    }
  });

  it("keeps semantic props closed and low-level attributes open", () => {
    const attributes: MediaAttributes = { viewBox: "0 0 10 10", "data-node": "x" };
    expect(attributes.viewBox).toBe("0 0 10 10");
    if (false) {
      const props: MediaProps = {
        // @ts-expect-error semantic props deliberately reject misspellings
        widht: 100,
      };
      expect(props).toBeDefined();
    }
  });
});
