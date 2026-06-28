import { describe, it, expect } from "vitest";
import { buildCompositeHtml } from "../html/html.js";

describe("buildCompositeHtml", () => {
  const width = 1920;
  const height = 1080;

  it("layers background, template, and watermark in order", () => {
    const html = buildCompositeHtml(
      "<main>content</main>",
      "#112233",
      "logo.png",
      width,
      height
    );
    const bgIdx = html.indexOf("background:#112233");
    const templateIdx = html.indexOf("<main>content</main>");
    const watermarkIdx = html.indexOf('src="logo.png"');
    expect(bgIdx).toBeGreaterThan(-1);
    expect(templateIdx).toBeGreaterThan(bgIdx);
    expect(watermarkIdx).toBeGreaterThan(templateIdx);
  });

  it("defaults to black background when none specified", () => {
    const html = buildCompositeHtml("<div />", undefined, undefined, width, height);
    expect(html).toContain("background:#000000");
  });

  it("renders image background with cover fit", () => {
    const html = buildCompositeHtml(
      "<div />",
      { src: "https://example.com/bg.jpg", fit: "cover", opacity: 1 },
      undefined,
      width,
      height
    );
    expect(html).toContain("background:url(");
    expect(html).toContain("center/cover");
  });

  it("wraps template in absolute inset container", () => {
    const html = buildCompositeHtml("<span>frame</span>", "#000", undefined, width, height);
    expect(html).toContain('position:absolute;inset:0;overflow:hidden');
    expect(html).toContain("<span>frame</span>");
  });

  it("positions watermark with z-index above template", () => {
    const html = buildCompositeHtml(
      "<div>main</div>",
      "#000",
      { content: "WM", type: "text", position: "top-left", opacity: 0.5 },
      width,
      height
    );
    expect(html).toContain("z-index: 9999");
    expect(html).toContain("top: 20px; left: 20px;");
    expect(html).toContain("<span>WM</span>");
  });

  it("wraps watermark in link when href provided", () => {
    const html = buildCompositeHtml(
      "<div />",
      "#000",
      { content: "logo.png", type: "image", href: "https://example.com" },
      width,
      height
    );
    expect(html).toContain('<a href="https://example.com"');
  });
});