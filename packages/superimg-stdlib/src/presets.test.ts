import { describe, it, expect } from "vitest";
import {
  getPreset,
  listPresets,
  listVideoPresets,
  formatPresetLabel,
  platforms,
} from "./presets.js";

describe("getPreset", () => {
  it("returns preset for valid path", () => {
    const preset = getPreset("instagram.video.reel");
    expect(preset).toBeDefined();
    expect(preset?.width).toBe(1080);
    expect(preset?.height).toBe(1920);
    expect(preset?.aspect_ratio).toBe("9:16");
  });

  it("returns preset for youtube.video.long", () => {
    const preset = getPreset("youtube.video.long");
    expect(preset?.width).toBe(1920);
    expect(preset?.height).toBe(1080);
  });

  it("returns preset for tiktok.video.post", () => {
    const preset = getPreset("tiktok.video.post");
    expect(preset?.width).toBe(1080);
    expect(preset?.height).toBe(1920);
  });

  it("returns preset for image category", () => {
    const preset = getPreset("instagram.images.post");
    expect(preset?.width).toBe(1080);
    expect(preset?.height).toBe(1080);
  });

  it("returns undefined for unknown platform", () => {
    expect(getPreset("unknown.video.post")).toBeUndefined();
  });

  it("returns undefined for unknown category", () => {
    expect(getPreset("instagram.unknown.post")).toBeUndefined();
  });

  it("returns undefined for unknown preset name", () => {
    expect(getPreset("instagram.video.nonexistent")).toBeUndefined();
  });

  it("returns undefined for malformed path", () => {
    expect(getPreset("")).toBeUndefined();
    expect(getPreset("instagram")).toBeUndefined();
  });

  it("handles x_twitter platform", () => {
    const preset = getPreset("x_twitter.video.post");
    expect(preset?.width).toBe(1280);
    expect(preset?.height).toBe(720);
  });
});

describe("listPresets", () => {
  it("returns array of preset entries", () => {
    const list = listPresets();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("each entry has path and preset", () => {
    const list = listPresets();
    for (const entry of list) {
      expect(entry).toHaveProperty("path");
      expect(entry).toHaveProperty("preset");
      expect(entry.preset).toHaveProperty("width");
      expect(entry.preset).toHaveProperty("height");
    }
  });

  it("paths are dot-separated", () => {
    const list = listPresets();
    const instagramReel = list.find((e) => e.path === "instagram.video.reel");
    expect(instagramReel).toBeDefined();
    expect(instagramReel?.preset.width).toBe(1080);
  });
});

describe("listVideoPresets", () => {
  it("returns only video presets", () => {
    const list = listVideoPresets();
    expect(Array.isArray(list)).toBe(true);
    for (const entry of list) {
      expect(entry.path).toContain(".video.");
    }
  });

  it("includes instagram reel", () => {
    const list = listVideoPresets();
    const reel = list.find((e) => e.path === "instagram.video.reel");
    expect(reel).toBeDefined();
  });

  it("excludes image presets", () => {
    const list = listVideoPresets();
    const post = list.find((e) => e.path === "instagram.images.post");
    expect(post).toBeUndefined();
  });
});

describe("formatPresetLabel", () => {
  it("formats instagram video reel", () => {
    expect(formatPresetLabel("instagram.video.reel")).toBe("Instagram Reel");
  });

  it("replaces underscore in platform with slash", () => {
    expect(formatPresetLabel("x_twitter.video.post")).toMatch(/\/[Tt]witter/);
  });

  it("replaces underscores in name with spaces", () => {
    expect(formatPresetLabel("pinterest.video.idea_pin")).toContain("Idea pin");
  });

  it("capitalizes platform and name", () => {
    const label = formatPresetLabel("youtube.video.short");
    expect(label).toMatch(/^[A-Z]/);
    expect(label).toContain("Short");
  });
});

describe("platforms", () => {
  it("has expected platforms", () => {
    expect(platforms).toHaveProperty("instagram");
    expect(platforms).toHaveProperty("youtube");
    expect(platforms).toHaveProperty("tiktok");
    expect(platforms).toHaveProperty("linkedin");
  });
});
