import { describe, expect, it } from "vitest";
import { assertNoNativeSurfaceMarkup } from "./native-markup.js";

describe("native surface markup admission", () => {
  it("recognizes native executable tags while ignoring inert mentions", () => {
    for (const markup of [
      '<script data-superimg-native></script>',
      '<script type="module" data-superimg-native="yes"></script>',
    ]) expect(() => assertNoNativeSurfaceMarkup(markup)).toThrow(/Native surfaces/);
    for (const markup of [
      '<!-- <script data-superimg-native></script> -->',
      '<script>const example = "<script data-superimg-native>";</script>',
      '<style>.x:after { content: "<script data-superimg-native>" }</style>',
      '<p>data-superimg-native</p>',
      '<script data-note="data-superimg-native"></script>',
    ]) expect(() => assertNoNativeSurfaceMarkup(markup)).not.toThrow();
  });
});
