import { describe, expect, it, vi } from "vitest";
import { IframePresenter } from "./dom-presenter.js";

const sandboxOf = (el: HTMLElement) => el.getAttribute("sandbox");

describe("IframePresenter setLogicalSize", () => {
  it("initializes a standards document and preserves its accepted contents across load notifications", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      await presenter.present("<main>accepted frame</main>", 320, 180);
      const iframe = presenter.getElement() as HTMLIFrameElement;
      expect(iframe.contentDocument?.doctype?.name).toBe("html");
      iframe.dispatchEvent(new Event("load"));
      expect(iframe.contentDocument?.querySelectorAll("#root")).toHaveLength(1);
      expect(iframe.contentDocument?.getElementById("root")?.textContent).toBe("accepted frame");
    } finally { presenter.dispose(); container.remove(); }
  });

  it("updates scale wrapper dimensions without presenting HTML", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 960, height: 540, x: 0, y: 0, top: 0, left: 0, right: 960, bottom: 540, toJSON: () => ({}) }),
    });
    document.body.appendChild(container);

    const presenter = new IframePresenter();
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });

    presenter.setLogicalSize(1080, 1920);

    const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument;
    const scaleWrapper = doc?.getElementById("scale-wrapper");
    expect(scaleWrapper?.style.width).toBe("1080px");
    expect(scaleWrapper?.style.height).toBe("1920px");

    presenter.dispose();
    document.body.removeChild(container);
  });

  it("does not hang in a detached container and paints when later connected", async () => {
    const container = document.createElement("div");
    const presenter = new IframePresenter();
    presenter.attach(container);

    await presenter.present("<main>pending frame</main>", 320, 180);

    const loaded = new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });
    document.body.appendChild(container);
    await loaded;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const iframe = presenter.getElement() as HTMLIFrameElement;
      if (iframe.contentDocument?.getElementById("root")?.textContent) break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const iframe = presenter.getElement() as HTMLIFrameElement;
    expect(iframe.contentDocument?.getElementById("root")?.textContent).toContain(
      "pending frame",
    );

    presenter.dispose();
    container.remove();
  });
});

describe("IframePresenter sandbox", () => {
  it("defaults to a script-less sandbox (no allow-scripts → no escape warning)", () => {
    const presenter = new IframePresenter();
    expect(sandboxOf(presenter.getElement())).toBe("allow-same-origin");
  });

  it("dev mode enables allow-scripts", () => {
    const presenter = new IframePresenter({ playerMode: "dev" });
    const sandbox = sandboxOf(presenter.getElement());
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });

  it("refuses to downgrade sandbox after scripts were enabled", () => {
    const presenter = new IframePresenter({ playerMode: "dev" });
    expect(() => presenter.applyPolicy({ playerMode: "render-only" })).toThrow(
      /cannot downgrade sandbox/,
    );
  });
});

describe("IframePresenter stripHtml", () => {
  it("rejects native surfaces without replacing the last accepted frame", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter({ playerMode: "render-only" });
    try {
      presenter.attach(container);
      await presenter.present("<main>accepted</main>", 100, 100);
      await expect(presenter.present('<canvas></canvas><script data-superimg-native>void 0</script>', 100, 100)).rejects.toMatchObject({ code: "NATIVE_SURFACE_UNSUPPORTED" });
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument;
      expect(doc?.getElementById("root")?.textContent).toBe("accepted");
    } finally { presenter.dispose(); container.remove(); }
  });
  it("always purifies when stripHtml is on (including slash-form handlers)", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(container);
    const presenter = new IframePresenter({ playerMode: "render-only" });
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });

    await presenter.present(`<div>ok</div><svg/onload=alert(1)>`, 100, 100);

    const root = (presenter.getElement() as HTMLIFrameElement).contentDocument?.getElementById(
      "root",
    );
    expect(root?.innerHTML ?? "").toMatch(/ok/i);
    expect(root?.innerHTML ?? "").not.toMatch(/onload/i);
    expect(root?.innerHTML ?? "").not.toMatch(/alert/i);

    presenter.dispose();
    document.body.removeChild(container);
  });
});

describe("IframePresenter native clips", () => {
  it("presents a deterministic clip marker as one seekable browser video", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const presenter = new IframePresenter({ playerMode: "render-only" });
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });
    const frame = (time: string) => `<img data-superimg-clip data-src="https://media.example.test/clip.mp4" data-t="${time}" style="width:100%;height:100%" alt="">`;
    await presenter.present(frame("0.25"), 320, 180);
    const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
    const first = doc.querySelector("video[data-superimg-media]");
    expect(first?.getAttribute("src")).toBe("https://media.example.test/clip.mp4");
    expect(first?.getAttribute("data-t")).toBe("0.25");
    await presenter.present(frame("0.5"), 320, 180);
    expect(doc.querySelector("video[data-superimg-media]")).toBe(first);
    expect(first?.getAttribute("data-t")).toBe("0.5");
    presenter.dispose();
    container.remove();
  });
});

describe("IframePresenter chrome / background", () => {
  it("defaults to transparent stage so host/template own fill (no forced dark bars)", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(container);
    const presenter = new IframePresenter({ playerMode: "render-only" });
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });
    const iframe = presenter.getElement() as HTMLIFrameElement;
    expect(iframe.style.background).toMatch(/transparent/i);
    const bodyBg = iframe.contentDocument?.body.style.background ?? "";
    expect(bodyBg).toMatch(/transparent/i);
    const htmlBg =
      iframe.contentDocument?.documentElement.style.background ?? "";
    expect(htmlBg).toMatch(/transparent/i);
    await presenter.present(
      `<div style="width:100%;height:100%;background:rgb(255, 0, 0)">fill</div>`,
      100,
      100,
    );
    const root = iframe.contentDocument?.getElementById("root");
    expect(root?.textContent).toContain("fill");
    // Still transparent after present — template paints its own fill.
    expect(iframe.style.background).toMatch(/transparent/i);
    presenter.dispose();
    document.body.removeChild(container);
  });

  it("accepts optional solid stageBackground for export-style floors", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(container);
    const presenter = new IframePresenter({
      playerMode: "render-only",
      stageBackground: "#07070c",
    });
    presenter.attach(container);
    await new Promise<void>((resolve) => {
      presenter.getElement().addEventListener("load", () => resolve(), { once: true });
    });
    const iframe = presenter.getElement() as HTMLIFrameElement;
    expect(iframe.style.background).toMatch(/#07070c/i);
    const bodyBg = iframe.contentDocument?.body.style.background ?? "";
    expect(bodyBg).toMatch(/#07070c/i);
    presenter.dispose();
    document.body.removeChild(container);
  });
});

describe("IframePresenter resource retention", () => {
  it("retains resource nodes for equal content and replaces them for changed content", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      const css = ["@font-face{font-family:Probe;src:url(/probe.ttf)}"];
      const urls = ["/probe.css"];
      presenter.injectStyles(css, urls);
      await presenter.present("<main>first</main>", 320, 180);
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      const style = doc.querySelector('[data-superimg-media-style="inline"]');
      const link = doc.querySelector('[data-superimg-media-style="stylesheet"]');
      presenter.injectStyles([...css], [...urls]);
      await presenter.present("<main>updated data</main>", 320, 180);
      expect(doc.querySelector('[data-superimg-media-style="inline"]')).toBe(style);
      expect(doc.querySelector('[data-superimg-media-style="stylesheet"]')).toBe(link);
      css[0] = "body{color:red}";
      urls[0] = "/changed.css";
      presenter.injectStyles(css, urls);
      expect(doc.querySelector('[data-superimg-media-style="inline"]')).not.toBe(style);
      expect(doc.querySelector('[data-superimg-media-style="inline"]')?.textContent).toBe(css[0]);
      expect(doc.querySelector('[data-superimg-media-style="stylesheet"]')?.getAttribute("href")).toBe(urls[0]);
      presenter.injectStyles();
      expect(doc.querySelectorAll("[data-superimg-media-style]")).toHaveLength(0);
    } finally { presenter.dispose(); container.remove(); }
  });

  it("retains equivalent Tailwind resources while noticing mutated configuration", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter({ playerMode: "dev" });
    try {
      presenter.attach(container);
      await presenter.present("<main>first</main>", 320, 180);
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      // This test exercises resource identity, not CDN execution. Keep actual
      // script nodes in the DOM without loading external JavaScript.
      const createElement = doc.createElement.bind(doc);
      vi.spyOn(doc, "createElement").mockImplementation((tag) => {
        const node = createElement(tag);
        if (tag === "script") node.setAttribute("type", "application/json");
        return node;
      });
      presenter.applyPolicy({ playerMode: "dev", hasTailwind: true });
      const tailwind = { css: "@theme { --color-brand: red; }" };
      presenter.injectStyles([], [], tailwind);
      const script = doc.querySelector('[data-superimg-media-style="tailwind"]');
      expect(script).not.toBeNull();
      presenter.injectStyles([], [], { ...tailwind });
      expect(doc.querySelector('[data-superimg-media-style="tailwind"]')).toBe(script);
      tailwind.css = "@theme { --color-brand: blue; }";
      presenter.injectStyles([], [], tailwind);
      expect(doc.querySelector('[data-superimg-media-style="tailwind-config"]')?.textContent).toBe(tailwind.css);
    } finally { presenter.dispose(); container.remove(); vi.restoreAllMocks(); }
  });
});

describe("IframePresenter incremental presentation", () => {
  it("explicitly refreshes transformed host geometry with one read and no recurring reads", async () => {
    let width = 320;
    const container = document.createElement("div");
    const rect = vi.fn(() => ({ width, height: width * 180 / 320 } as DOMRect));
    container.getBoundingClientRect = rect;
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      await presenter.present("<main>initial</main>", 320, 180);
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      const wrapper = doc.getElementById("scale-wrapper")!;
      const revision = presenter.getDomRevision();
      rect.mockClear();
      width = 640;
      presenter.refreshGeometry();
      expect(rect).toHaveBeenCalledTimes(1);
      expect(wrapper.style.transform).toBe("translate(0px, 0px) scale(2)");
      expect(presenter.getDomRevision()).toBe(revision);
      for (let frame = 0; frame < 5; frame += 1) {
        await presenter.present(`<main>${frame}</main>`, 320, 180);
      }
      expect(rect).toHaveBeenCalledTimes(1);
    } finally { presenter.dispose(); container.remove(); }
  });

  it("does not read host layout or rewrite logical geometry on fixed-size frames", async () => {
    let width = 960;
    let height = 540;
    let onResize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { onResize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const container = document.createElement("div");
    const rect = vi.fn(() => ({ width, height } as DOMRect));
    container.getBoundingClientRect = rect;
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      await presenter.present("<main>one</main>", 320, 180);
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      const wrapper = doc.getElementById("scale-wrapper")!;
      const writes: MutationRecord[] = [];
      const observer = new MutationObserver((records) => writes.push(...records));
      observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
      rect.mockClear();
      for (let frame = 0; frame < 5; frame += 1) {
        await presenter.present(`<main>${frame}</main>`, 320, 180);
      }
      expect(rect).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(writes).toHaveLength(0);
      presenter.setLogicalSize(640, 360);
      expect(rect).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(writes).toHaveLength(3);
      expect(wrapper.style.width).toBe("640px");
      expect(wrapper.style.height).toBe("360px");
      expect(wrapper.style.transform).toBe("translate(0px, 0px) scale(1.5)");
      width = 480; height = 270;
      onResize();
      expect(rect).toHaveBeenCalledTimes(1);
      expect(wrapper.style.transform).toBe("translate(0px, 0px) scale(0.75)");
      onResize();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(writes).toHaveLength(4);
      observer.disconnect();
      presenter.dispose();
      expect(disconnect).toHaveBeenCalledTimes(1);
      rect.mockClear();
      onResize();
      expect(rect).not.toHaveBeenCalled();
    } finally { presenter.dispose(); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
  });

  it("waits for observed visibility instead of scheduling zero-size retry frames", async () => {
    let width = 0;
    let onResize = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { onResize = callback; }
      observe() {}
      disconnect() {}
    });
    const container = document.createElement("div");
    const rect = vi.fn(() => ({ width, height: width } as DOMRect));
    container.getBoundingClientRect = rect;
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      await presenter.present("<main>hidden</main>", 100, 100);
      rect.mockClear();
      for (let frame = 0; frame < 5; frame += 1) {
        await presenter.present(`<main>${frame}</main>`, 100, 100);
      }
      expect(rect).not.toHaveBeenCalled();
      width = 200;
      onResize();
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      expect(doc.getElementById("scale-wrapper")?.style.transform).toBe("translate(0px, 0px) scale(2)");
    } finally { presenter.dispose(); container.remove(); vi.unstubAllGlobals(); }
  });

  it("retains equal SVG branches without reconciling descendants and preserves keyed draw order", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter();
    const art = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs><g id="a"><path id="path" d="M0 0L10 10" fill="url(#paint)"/></g><g id="b"><circle r="2"/></g></svg>';
    try {
      presenter.attach(container);
      await presenter.present(`<main><p>one</p>${art}</main>`, 320, 180);
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      const path = doc.getElementById("path")!;
      const getAttribute = vi.spyOn(path, "getAttribute");
      await presenter.present(`<main><p>two</p>${art}</main>`, 320, 180);
      expect(doc.getElementById("path")).toBe(path);
      // morphdom still indexes ids before reconciliation; the equal SVG branch
      // skips descendant attribute/target work after that mandatory index pass.
      expect(getAttribute.mock.calls).toEqual([["id"]]);
      getAttribute.mockRestore();
      const a = doc.getElementById("a");
      const b = doc.getElementById("b");
      const swapped = art.replace('<g id="a"><path id="path" d="M0 0L10 10" fill="url(#paint)"/></g><g id="b"><circle r="2"/></g>', '<g id="b"><circle r="2"/></g><g id="a"><path id="path" d="M0 0L10 10" fill="url(#paint)"/></g>');
      await presenter.present(`<main><p>three</p>${swapped}</main>`, 320, 180);
      expect(doc.getElementById("a")).toBe(a);
      expect(doc.getElementById("b")).toBe(b);
      expect(doc.querySelector("svg")?.children[1]).toBe(b);
      expect(doc.querySelector("svg")?.children[2]).toBe(a);
      expect(path.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(path.getAttribute("fill")).toBe("url(#paint)");
    } finally { presenter.dispose(); container.remove(); vi.restoreAllMocks(); }
  });

  it("caches repeated purified markup and invalidates on changed resources and disposal", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      const frame = (value: string) => `<main>${value}<svg/onload=evil()><text>safe</text></svg><script>evil()</script></main>`;
      for (const value of ["a", "b", "a", "b", "a", "b"]) {
        await presenter.present(frame(value), 320, 180);
      }
      expect(presenter.getCacheStats()).toMatchObject({ hits: 2, misses: 4, entries: 2 });
      presenter.injectStyles([], []);
      expect(presenter.getCacheStats()).toMatchObject({ hits: 2, misses: 4, entries: 2 });
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      expect(doc.getElementById("root")?.innerHTML).not.toMatch(/script|onload|evil/i);
      presenter.injectStyles(["main{color:red}"]);
      expect(presenter.getCacheStats()).toBeNull();
      await presenter.present(frame("b"), 320, 180);
      expect(presenter.getCacheStats()).toMatchObject({ hits: 0, misses: 1, entries: 0 });
      presenter.dispose();
      expect(presenter.getCacheStats()).toBeNull();
    } finally { presenter.dispose(); container.remove(); }
  });

  it("changes target revision only for membership and prevents a caller sanitizer bypass", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const presenter = new IframePresenter();
    try {
      presenter.attach(container);
      await presenter.present('<main><video data-superimg-media="video" data-t="0"></video><button data-si-action="seek">one</button></main>', 320, 180);
      const revision = presenter.getDomRevision();
      await presenter.present('<main><video data-superimg-media="video" data-t="1"></video><button data-si-action="seek">two</button></main>', 320, 180);
      expect(presenter.getDomRevision()).toBe(revision);
      await presenter.present('<main><video data-t="2"></video><button>three</button></main>', 320, 180);
      expect(presenter.getDomRevision()).toBeGreaterThan(revision);
      await presenter.present('<main onclick="evil()">safe<script>evil()</script></main>', 320, 180, { escapedTree: {} });
      const doc = (presenter.getElement() as HTMLIFrameElement).contentDocument!;
      expect(doc.getElementById("root")?.innerHTML).not.toMatch(/script|onclick|evil/i);
    } finally { presenter.dispose(); container.remove(); }
  });
});
