import { describe, expect, it } from "vitest";
import { video } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { hashTemplateOutputs } from "../ir/pure/serialize.js";
import { sequence } from "./sequence.js";
import { time } from "./time.js";
import { compose } from "./compose.js";

describe("native composition resources", () => {
  it("retains one verified closure for repeated occurrences in both composition APIs", () => {
    const outputs = [{ type: "asset" as const, fileName: "world.bin", source: new Uint8Array([1, 2, 3]) }];
    const set = { identity: hashTemplateOutputs(outputs), outputs };
    const scene = video({ size: { width: 64, height: 64 }, duration: "1s", nativeModuleSets: [set], render: () => Html({ html: "scene" }) });
    const projected = time(sequence([{ id: "a", content: scene }, { id: "b", content: scene }]), { size: { width: 64, height: 64 }, fps: 2 });
    expect(projected.config?.nativeModuleSets).toEqual([set]);
    expect(compose([scene, scene]).config?.nativeModuleSets).toEqual([set]);
    const broken = video({ size: { width: 64, height: 64 }, duration: "1s", nativeModuleSets: [{ ...set, outputs: [{ ...outputs[0]!, source: new Uint8Array([9]) }] }], render: () => Html({ html: "scene" }) });
    expect(() => time(sequence([{ id: "a", content: scene }, { id: "b", content: broken }]), { size: { width: 64, height: 64 }, fps: 2 })).toThrow(/identity does not match/);
  });
});
