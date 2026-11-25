import { describe, expect, it } from "vitest";
import {
  detectWallClockCssHints,
  needsTemplateSanitization,
  sanitizeTemplateFragmentNode,
  sanitizeTemplateHtml,
  SanitizedFragmentCache,
} from "./sanitize-html.js";

describe("sanitizeTemplateHtml (DOMPurify core)", () => {
  it("strips script tags", () => {
    const { html, stripped } = sanitizeTemplateHtml(
      `<div>ok</div><script>alert(1)</script>`,
      document,
    );
    expect(html).toContain("ok");
    expect(html).not.toMatch(/<script/i);
    expect(stripped.some((s) => s.kind === "script")).toBe(true);
  });

  it("strips on* handlers including SMIL-like names", () => {
    const { html } = sanitizeTemplateHtml(
      `<button onclick="evil()">x</button><svg><animate onbegin="evil()" /></svg>`,
      document,
    );
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/onbegin/i);
    expect(html).not.toMatch(/evil/i);
  });

  it("strips slash-form event handlers that prefilters used to miss", () => {
    const { html } = sanitizeTemplateHtml(`<svg/onload=alert(1)><text>ok</text></svg>`, document);
    expect(html).not.toMatch(/onload/i);
    expect(html).not.toMatch(/alert/i);
    expect(html).toMatch(/ok/i);
  });

  it("labels javascript: href removals as javascript-url, not plain href", () => {
    const { stripped } = sanitizeTemplateHtml(
      `<a href="javascript:alert(1)">x</a>`,
      document,
    );
    expect(stripped.some((s) => s.kind === "javascript-url")).toBe(true);
  });

  it("strips base and meta (forbidden in composite root)", () => {
    const { html } = sanitizeTemplateHtml(
      `<base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test"><div>ok</div>`,
      document,
    );
    // FORBID_TAGS — presence in strip log is best-effort (DOMPurify may omit entries).
    expect(html).not.toMatch(/<base/i);
    expect(html).not.toMatch(/<meta/i);
    expect(html).toContain("ok");
  });

  it("strips javascript: urls", () => {
    const { html, stripped } = sanitizeTemplateHtml(
      `<a href="javascript:alert(1)">x</a>`,
      document,
    );
    expect(html).not.toMatch(/javascript:/i);
    expect(stripped.some((s) => s.kind === "javascript-url" || s.kind === "other")).toBe(true);
  });

  it("strips tab-encoded javascript: URLs (java\\tscript:)", () => {
    // Historic bypass against hand-rolled /^\s*javascript:/i
    const { html } = sanitizeTemplateHtml(
      `<a href="java\tscript:alert(1)">x</a>`,
      document,
    );
    expect(html).not.toMatch(/javascript/i);
    expect(html).not.toMatch(/alert/i);
  });

  it("strips formaction javascript: URLs", () => {
    const { html } = sanitizeTemplateHtml(
      `<form><button formaction="javascript:alert(1)">go</button></form>`,
      document,
    );
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/alert/i);
  });

  it("strips SVG embedded script", () => {
    const { html, stripped } = sanitizeTemplateHtml(
      `<svg><script>alert(1)</script><text>ok</text></svg>`,
      document,
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/alert/i);
    expect(stripped.some((s) => s.kind === "script" || s.kind === "other")).toBe(true);
  });

  it("resists a simple mXSS-style namespace sample", () => {
    // Classic parser-confusion / namespace shape; DOMPurify should not leave executable script.
    const { html } = sanitizeTemplateHtml(
      `<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img&nbsp;src=x&nbsp;onerror=alert(1)&gt;">`,
      document,
    );
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/alert\s*\(/i);
  });

  it("preserves data-si-* action attrs", () => {
    const { html } = sanitizeTemplateHtml(
      `<button data-si-action="seek" data-si-arg="0.5">Go</button>`,
      document,
    );
    expect(html).toContain('data-si-action="seek"');
    expect(html).toContain('data-si-arg="0.5"');
    expect(html).toContain("Go");
  });
});

const fragmentMarkup = (fragment: DocumentFragment): string => {
  const wrapper = fragment.ownerDocument.createElement("div");
  wrapper.append(fragment.cloneNode(true));
  return wrapper.innerHTML;
};

describe("SanitizedFragmentCache", () => {
  it("admits only repeated exact source and returns private safe clones", () => {
    const cache = new SanitizedFragmentCache(document);
    const source = '<svg><defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs><g id="art"><path d="M0 0L10 10" fill="url(#paint)" onload="evil()"/></g></svg><script>evil()</script>';
    const baseline = sanitizeTemplateHtml(source, document).html;
    const first = cache.sanitize(source);
    expect(cache.getStats().entries).toBe(0);
    expect(fragmentMarkup(first.fragment)).toBe(baseline);
    const admitted = cache.sanitize(source);
    expect(cache.getStats().entries).toBe(1);
    admitted.fragment.firstChild?.appendChild(admitted.fragment.ownerDocument.createElement("script"));
    admitted.stripped.length = 0;
    const cached = cache.sanitize(source);
    expect(fragmentMarkup(cached.fragment)).toBe(baseline);
    expect(cached.stripped.length).toBeGreaterThan(0);
    expect(cache.getStats().hits).toBe(1);
    expect(cached.fragment.querySelector("svg")?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(cached.fragment.querySelector("path")?.getAttribute("fill")).toBe("url(#paint)");
    expect(cache.sanitize(source + " ").fragment).toBeTruthy();
    expect(cache.getStats().hits).toBe(1);
  });

  it("keeps cached malicious corpus equivalent to the uncached policy", () => {
    const cache = new SanitizedFragmentCache(document);
    const corpus = [
      '<svg/onload=alert(1)><text>ok</text></svg>',
      '<a href="java\tscript:alert(1)">x</a>',
      '<svg><foreignObject><iframe srcdoc="<script>evil()</script>"></iframe><img src=x onerror=evil()></foreignObject></svg>',
      '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img src=x onerror=evil()&gt;">',
      '<base href="https://evil.test"><meta http-equiv="refresh" content="0;url=https://evil.test"><form><button formaction="javascript:evil()">go</button></form>',
    ];
    for (const source of corpus) {
      const expected = sanitizeTemplateHtml(source, document).html;
      for (let repeat = 0; repeat < 3; repeat += 1) {
        expect(fragmentMarkup(cache.sanitize(source).fragment)).toBe(expected);
      }
    }
    expect(cache.getStats().hits).toBe(corpus.length);
  });

  it("bounds source bytes, nodes and entry count during changing/repeated frames", () => {
    const cache = new SanitizedFragmentCache(document, 3, 200, 6);
    for (let index = 0; index < 100; index += 1) {
      const source = `<div id="${index}">frame ${index}</div>`;
      cache.sanitize(source);
      cache.sanitize(source);
      const stats = cache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(3);
      expect(stats.recentSources).toBeLessThanOrEqual(3);
      expect(stats.retainedSourceBytes).toBeLessThanOrEqual(200);
      expect(stats.retainedNodes).toBeLessThanOrEqual(6);
    }
    const oversized = '<div>' + '<span>x</span>'.repeat(20) + '</div>';
    cache.sanitize(oversized);
    cache.sanitize(oversized);
    expect(cache.getStats().retainedNodes).toBeLessThanOrEqual(6);
    const stats = cache.getStats();
    expect(Object.keys(stats).every((key) => typeof stats[key as keyof typeof stats] === "number")).toBe(true);
    cache.clear();
    expect(cache.getStats()).toMatchObject({ entries: 0, recentSources: 0, retainedSourceBytes: 0, retainedNodes: 0 });
  });
});

describe("needsTemplateSanitization", () => {
  it("returns false for clean template HTML", () => {
    expect(needsTemplateSanitization(`<div class="hero"><p>Hello</p></div>`)).toBe(false);
  });

  it("returns true when script-like surface is present", () => {
    expect(needsTemplateSanitization(`<div onclick="x()">x</div>`)).toBe(true);
    expect(needsTemplateSanitization(`<div><script>x</script></div>`)).toBe(true);
  });

  it("flags slash-form event handlers (no space before on*)", () => {
    expect(needsTemplateSanitization(`<svg/onload=alert(1)>`)).toBe(true);
    expect(needsTemplateSanitization(`<img/onerror=alert(1) src=x>`)).toBe(true);
  });

  it("flags iframe/object/embed/srcdoc surfaces", () => {
    expect(needsTemplateSanitization(`<iframe src="https://evil.test"></iframe>`)).toBe(true);
    expect(needsTemplateSanitization(`<object data="x"></object>`)).toBe(true);
    expect(needsTemplateSanitization(`<div srcdoc="<script>x</script>"></div>`)).toBe(true);
  });
});

describe("sanitizeTemplateFragmentNode", () => {
  it("returns a fragment with scripts stripped", () => {
    const { fragment, stripped } = sanitizeTemplateFragmentNode(
      `<div>ok</div><script>alert(1)</script>`,
      document,
    );
    expect(fragment).toBeTruthy();
    expect(stripped.some((s) => s.kind === "script")).toBe(true);

    const { html } = sanitizeTemplateHtml(
      `<div>ok</div><script>alert(1)</script>`,
      document,
    );
    expect(html).toContain("ok");
    expect(html).not.toMatch(/<script/i);
  });
});

describe("detectWallClockCssHints", () => {
  it("flags keyframes and animation-name", () => {
    expect(detectWallClockCssHints("@keyframes spin {} .x{animation-name:spin}")).toContain(
      "css-animation",
    );
  });

  it("flags scroll-driven timelines", () => {
    expect(
      detectWallClockCssHints(".x{animation-timeline: scroll()}"),
    ).toContain("scroll-driven-animation");
  });
});
