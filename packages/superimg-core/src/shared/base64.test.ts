import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesDataUrl, encodeBase64 } from "./base64.js";

const nativeDescriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "toBase64");
afterEach(() => {
  vi.unstubAllGlobals();
  if (nativeDescriptor) Object.defineProperty(Uint8Array.prototype, "toBase64", nativeDescriptor);
  else Reflect.deleteProperty(Uint8Array.prototype, "toBase64");
});

it("calls the native prototype intrinsic with the original byte view", () => {
  const storage = new Uint8Array([99, 0, 1, 254, 255, 88]);
  const view = storage.subarray(1, 5);
  const native = vi.fn(function (this: Uint8Array) {
    expect(this).toBe(view);
    return Buffer.from(this).toString("base64");
  });
  Object.defineProperty(Uint8Array.prototype, "toBase64", { configurable: true, writable: true, value: native });
  Object.defineProperty(view, "toBase64", { value: () => { throw Error("instance override must not run"); } });
  vi.stubGlobal("btoa", () => { throw Error("native encoding must not allocate binary strings"); });
  expect(encodeBase64(view)).toBe("AAH+/w==");
  expect(bytesDataUrl(view, "application/octet-stream")).toBe("data:application/octet-stream;base64,AAH+/w==");
  expect(native).toHaveBeenCalledTimes(2);
});
describe.each(["web", "fallback"])("portable base64 (%s)", (mode) => {
  it.each([0, 1, 2, 3, 4, 5, 255, 24_575, 24_576, 24_577, 24_578, 1_048_577])("encodes every byte and padding at length %i", (length) => {
    Object.defineProperty(Uint8Array.prototype, "toBase64", { configurable: true, writable: true, value: undefined });
    if (mode === "fallback") vi.stubGlobal("btoa", undefined);
    const storage = Uint8Array.from({ length: length + 17 }, (_, i) => (i * 73) & 255);
    const bytes = storage.subarray(7, 7 + length);
    const expected = Buffer.from(bytes).toString("base64");
    expect(encodeBase64(bytes)).toBe(expected);
    expect(bytesDataUrl(bytes, "application/octet-stream")).toBe(`data:application/octet-stream;base64,${expected}`);
    expect(storage[7 + length]).toBe(((7 + length) * 73) & 255);
  });
});
