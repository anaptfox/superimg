import { describe, it, expect } from "vitest";
import { highlight, getThemes, getLangs } from "./code";

describe("code.highlight", () => {
  it("returns highlighted HTML for typescript", () => {
    const html = highlight("const x = 1;", { lang: "typescript" });
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("const");
  });

  it("accepts lang aliases", () => {
    const js = highlight("let a = 1", { lang: "js" });
    const ts = highlight("let a: number = 1", { lang: "ts" });
    expect(js).toContain("<code");
    expect(ts).toContain("<code");
  });

  it("applies theme", () => {
    const html = highlight("fn main() {}", { lang: "rust", theme: "dracula" });
    expect(html).toContain("<pre");
  });

  it("adds line numbers when requested", () => {
    const html = highlight("line1\nline2\nline3", {
      lang: "javascript",
      lineNumbers: true,
    });
    expect(html).toContain('class="line-number"');
    expect(html).toContain("1");
    expect(html).toContain("3");
  });

  it("highlights json", () => {
    const html = highlight('{"key": "value"}', { lang: "json" });
    expect(html).toContain("key");
  });

  it("highlights bash", () => {
    const html = highlight("echo hello", { lang: "sh" });
    expect(html).toContain("echo");
  });
});

describe("code metadata", () => {
  it("lists available themes", () => {
    const themes = getThemes();
    expect(themes).toContain("dark-plus");
    expect(themes).toContain("dracula");
    expect(themes.length).toBe(5);
  });

  it("lists available languages including aliases", () => {
    const langs = getLangs();
    expect(langs).toContain("typescript");
    expect(langs).toContain("js");
    expect(langs).toContain("py");
    expect(langs).toContain("md");
  });
});