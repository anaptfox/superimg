import { describe, expect, it } from "vitest";
import { resolvePlayerPolicy } from "./player-policy.js";

describe("resolvePlayerPolicy", () => {
  it("render-only never allows scripts even with tailwind", () => {
    const p = resolvePlayerPolicy({ playerMode: "render-only", hasTailwind: true });
    expect(p.allowScripts).toBe(false);
    expect(p.stripHtml).toBe(true);
    expect(p.reexecuteScripts).toBe(false);
    expect(p.injectTailwindCdn).toBe(false);
    expect(p.warnDefault).toBe(false);
  });

  it("dev player trusts scripts and re-executes islands", () => {
    const p = resolvePlayerPolicy({ playerMode: "dev", hasTailwind: true });
    expect(p.allowScripts).toBe(true);
    expect(p.reexecuteScripts).toBe(true);
    expect(p.stripHtml).toBe(false);
    expect(p.injectTailwindCdn).toBe(true);
    expect(p.warnDefault).toBe(true);
  });

  it("dev without tailwind still allows scripts for islands", () => {
    const p = resolvePlayerPolicy({ playerMode: "dev", hasTailwind: false });
    expect(p.allowScripts).toBe(true);
    expect(p.injectTailwindCdn).toBe(false);
  });

  it("export Chromium is not this policy — render-only is the Player embed sanitizer", () => {
    const p = resolvePlayerPolicy({ playerMode: "render-only" });
    expect(p.stripHtml).toBe(true);
    expect(p.allowScripts).toBe(false);
    expect(p.reexecuteScripts).toBe(false);
  });

  it("omitted playerMode defaults to render-only", () => {
    const p = resolvePlayerPolicy({});
    expect(p.mode).toBe("render-only");
    expect(p.warnDefault).toBe(false);
  });
});
