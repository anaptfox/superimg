import { describe, expect, it } from "vitest";
import {
  bindPooledStillPage,
  chooseStillRendererKind,
  stillPageKey,
} from "./still-page-pool.js";

describe("chooseStillRendererKind", () => {
  it("keeps CLI isolation unless pooling is requested", () => {
    expect(chooseStillRendererKind(undefined)).toBe("fresh");
    expect(chooseStillRendererKind(false)).toBe("fresh");
    expect(chooseStillRendererKind(true)).toBe("pooled");
  });
});

describe("stillPageKey", () => {
  it("keys the pool by size and device scale", () => {
    expect(stillPageKey(2880, 1800, 2)).toBe("2880x1800@2");
  });
});

describe("bindPooledStillPage", () => {
  it("returns the bound renderer when init succeeds", async () => {
    const released: string[] = [];
    const bound = await bindPooledStillPage({
      acquire: async () => "page",
      release: (page) => {
        released.push(page);
      },
      bind: (page) => ({ page, ready: false }),
      init: async (inner) => {
        inner.ready = true;
      },
    });
    expect(bound).toEqual({ page: "page", inner: { page: "page", ready: true } });
    expect(released).toEqual([]);
  });

  it("releases the acquired page when init throws", async () => {
    const released: string[] = [];
    await expect(
      bindPooledStillPage({
        acquire: async () => "leaked",
        release: (page) => {
          released.push(page);
        },
        bind: (page) => ({ page }),
        init: async () => {
          throw new Error("shell failed");
        },
      }),
    ).rejects.toThrow("shell failed");
    expect(released).toEqual(["leaked"]);
  });
});
