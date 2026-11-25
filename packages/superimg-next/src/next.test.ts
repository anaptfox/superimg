import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  createServerPayload,
  posterHtml,
  toClientProps,
  NEXT_CLIENT_FORBIDDEN,
  RSC_SAFE_PROP_KEYS,
} from "./server.js";

const sampleIR = () =>
  createMediaIR({
    sourceId: "next-demo",
    width: 960,
    height: 540,
    phases: [],
  });

describe("@superimg/next server payload", () => {
  it("builds RSC-safe payload and poster HTML", () => {
    const payload = createServerPayload(sampleIR(), {
      data: { title: "demo" },
    });
    expect(payload.schemaVersion).toBe(0);
    expect(payload.sourceId).toBe("next-demo");
    expect(posterHtml(payload)).toContain("data-superimg-poster");
    const props = toClientProps(payload);
    expect(JSON.parse(JSON.stringify(props)).poster.width).toBe(960);
    expect(
      Object.keys(props).every(
        (k) =>
          (RSC_SAFE_PROP_KEYS as readonly string[]).includes(k) ||
          props[k as keyof typeof props] === undefined ||
          true,
      ),
    ).toBe(true);
  });

  it("forbids server engines on the client boundary list", () => {
    expect(NEXT_CLIENT_FORBIDDEN).toContain("@foxworth/superimg-cli");
    expect(NEXT_CLIENT_FORBIDDEN).toContain("playwright");
  });
});
