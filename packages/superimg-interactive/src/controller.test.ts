import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IframePresenter } from "@superimg/media";
import { defineInteractive } from "./definition.js";
import { createInteractivePlayer } from "./controller.js";
import { Frame, Html, Text, h } from "@superimg/stdlib/tree";
import type { SceneStyleRenderer } from "./contracts.js";
import type { JsonObject } from "@superimg/types";

interface LiveData { projection: { title: string; revision: string; reaction?: string } }

function buttonMedia() {
  return defineInteractive<LiveData>({
    size: { width: 320, height: 180 },
    guide: { id: "live", steps: [{ id: "trade", label: "Trade", duration: "2s", scene: {} }] },
    render(ctx) {
      const node = ctx.scene.node("answer", {
        actions: ["explain"], metadata: { revision: ctx.data.projection.revision },
      });
      return Html({ width: "fill", height: "fill", html: `<button ${node.attrs}>${ctx.data.projection.title}</button>` });
    },
  });
}

function mountController() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return { host, controller: createInteractivePlayer<LiveData>({ container: host }) };
}

function live(title: string): LiveData { return { projection: { title, revision: title } }; }

afterEach(() => vi.restoreAllMocks());

describe("InteractivePlayerController", () => {
  it("forwards bounded passive diagnostics and records the accepted data revision", async () => {
    const { controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First"), performance: { capacity: 2 } });
    await controller.setData(live("Newest"));
    expect(controller.player.getPerformance()).toMatchObject({ generation: 1, capacity: 2,
      counters: { accepted: 2 }, byKind: { update: { accepted: 1 } } });
    expect(controller.player.getPresentation().accepted?.inputRevision).toBe(1);
    expect(JSON.stringify(controller.player.getPerformance())).not.toContain("Newest");
    controller.dispose();
  });
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("prepares capabilities from the authored render through lowering, controller wrapping, and Player clones", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const lesson = defineInteractive({
      size: { width: 320, height: 180 },
      guide: { id: "motion", steps: [{ id: "hold", label: "Hold", duration: "1s", scene: {} }] },
      render(ctx) {
        const { std: n, timeline: r } = ctx;
        const y = n.oscillate(r.seconds, { period: "1s", from: -8, to: 8 });
        const node = ctx.scene.node("subject", { label: "Floating subject" });
        return Html({ width: "fill", height: "fill", html: `<p ${node.attrs} data-y="${y}" style="color:${n.color.alpha("#ffffff", 0.5)}">Floating</p>` });
      },
    });
    const controller = createInteractivePlayer<JsonObject>({ container: host });
    const rendered: string[] = [];
    controller.player.on("rendered", ({ html }) => rendered.push(html));
    try {
      const result = await controller.load(lesson, { data: {} });
      expect(result).toMatchObject({ status: "success" });
      expect(rendered.at(-1)).toContain("Floating");
      expect(rendered.at(-1)).toContain("rgba(");
      const first = rendered.at(-1);
      await controller.player.seek({ seconds: 0.25 });
      expect(rendered.at(-1)).not.toBe(first);
      expect(controller.sceneSnapshot.nodes.some((node) => node.id === "subject")).toBe(true);
    } finally { controller.dispose(); }
  });

  it("loads one definition, accepts live data, and navigates its guide", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const lesson = defineInteractive<{ title: string }>({
      guide: {
        id: "lesson",
        steps: [
          { id: "one", label: "One", duration: "1s", scene: { state: "one" } },
          { id: "two", label: "Two", duration: "1s", scene: { state: "two" } },
        ],
      },
      render(ctx) {
        const title = ctx.scene.node("title", { label: "Title" });
        ctx.scene.states({
          one: { nodes: { title: { properties: { step: "one" } } } },
          two: { nodes: { title: { properties: { step: "two" } } } },
        });
        return Html({ width: "fill", height: "fill", html: `<h1 ${title.attrs}>${ctx.data.title}</h1>` });
      },
    });
    const controller = createInteractivePlayer<{ title: string }>({ container: host });
    const rendered: string[] = [];
    controller.player.on("rendered", (payload) => rendered.push(payload.html));

    const result = await controller.load(lesson, { data: { title: "First" } });
    if (result.status === "error") throw new Error(result.message);
    expect(result.status).toBe("success");
    expect(rendered.at(-1)).toContain("First");

    await controller.setData({ title: "Live" });
    expect(rendered.at(-1)).toContain("Live");

    await controller.guide.goToStep("two");
    expect(controller.guide.currentStep?.stepId).toBe("two");
    expect(controller.sceneSnapshot.activeState).toBe("two");

    controller.dispose();
  });

  it("derives the guide clock before validating second-based director phases", async () => {
    const steps = ["overview", "auth", "data", "media"].map((id) => ({
      id,
      label: id,
      duration: "2s",
      scene: { state: id },
    }));
    const lesson = defineInteractive({
      guide: { id: "architecture", steps },
      render(ctx) {
        ctx.director({ intro: "2.6s", hold: "5.4s" });
        const subject = ctx.scene.node("subject", { label: "Subject" });
        ctx.scene.states(
          Object.fromEntries(
            steps.map(({ id }) => [
              id,
              { nodes: { subject: { properties: { step: id } } } },
            ]),
          ),
        );
        return Html({
          width: "fill",
          height: "fill",
          html: `<p ${subject.attrs}>${ctx.timeline.durationSeconds}</p>`,
        });
      },
    });
    const controller = createInteractivePlayer<JsonObject>({
      container: document.createElement("div"),
    });

    const result = await controller.load(lesson, { data: {} });

    expect(result).toMatchObject({
      status: "success",
      duration: 8,
      totalFrames: 240,
      fps: 30,
    });
    expect(controller.guide.resolved).toMatchObject({
      totalSeconds: 8,
      totalFrames: 240,
      fps: 30,
    });
    controller.dispose();
  });

  it("dispatches one native action with the accepted immutable presentation identity", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const actions: unknown[] = [];
    controller.on("action", (event) => actions.push(event));
    await controller.player.seek({ frame: 8 });
    const shown = controller.player.getPresentation();
    host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click();
    expect(actions).toEqual([{
      action: "explain", nodeId: "answer", frame: shown.accepted!.frame,
      presentation: { generation: shown.generation, revision: shown.accepted!.revision,
        frame: shown.accepted!.frame, sceneId: controller.sceneSnapshot.sceneId },
    }]);
    expect(Object.isFrozen(controller.sceneSnapshot.nodes[0]?.metadata)).toBe(true);
    controller.dispose();
  });

  it("keeps typed art out of Html and binds typed actions to accepted semantic state", async () => {
    const { host, controller } = mountController();
    const media = defineInteractive<LiveData>({
      size: { width: 320, height: 180 },
      guide: { id: "typed", steps: [{ id: "trade", label: "Trade", duration: "2s", scene: {} }] },
      render(ctx) {
        const answer = ctx.scene.node("answer", { actions: ["explain"], metadata: { revision: ctx.data.projection.revision } });
        return Frame({ width: "fill", height: "fill" }, Text("Heading"),
          answer.element(h("button", { id: "answer-button" }, ctx.data.projection.title)));
      },
    });
    await controller.load(media, { data: live("First") });
    const doc = host.querySelector("iframe")!.contentDocument!;
    expect(doc.querySelector('[data-si-primitive="Html"]')).toBeNull();
    expect(doc.querySelectorAll('[data-si-primitive="Text"]')).toHaveLength(1);
    const actions: unknown[] = [];
    controller.on("action", (event) => actions.push(event));
    await controller.setData(live("Next"));
    doc.querySelector<HTMLButtonElement>("button")!.click();
    expect(actions).toHaveLength(1);
    expect(controller.sceneSnapshot.nodes[0]?.metadata.revision).toBe("Next");
    await controller.scene.hide("answer");
    expect(doc.querySelector<HTMLButtonElement>("button")!.style.display).toBe("none");
    doc.querySelector<HTMLButtonElement>("button")!.click();
    expect(actions).toHaveLength(1);
    controller.dispose();
  });

  it("retains render-only sanitation for malicious low-level typed attributes and script nodes", async () => {
    const { host, controller } = mountController();
    const media = defineInteractive<LiveData>({
      size: { width: 320, height: 180 },
      guide: { id: "typed-policy", steps: [{ id: "start", label: "Start", duration: "1s", scene: {} }] },
      render: () => Frame({ width: "fill", height: "fill" },
        h("script", null, "window.__bad = true"),
        h("a", { href: "javascript:alert(1)", onclick: "alert(2)" }, "Link"),
        h("img", { src: "javascript:alert(3)", onerror: "alert(4)" }),
      ),
    });
    await controller.load(media, { data: live("First") });
    const doc = host.querySelector("iframe")!.contentDocument!;
    expect(doc.querySelector("#root script")).toBeNull();
    expect(doc.querySelector("#root [onclick],#root [onerror]")).toBeNull();
    expect(doc.querySelector("#root a")?.getAttribute("href")).toBeNull();
    expect(doc.querySelector("#root img")?.getAttribute("src")).toBeNull();
    controller.dispose();
  });

  it("maintains pointer policy and delegated dispatch across target replacement without frame scans", async () => {
    const { host, controller } = mountController();
    const media = defineInteractive<LiveData>({
      size: { width: 320, height: 180 },
      guide: { id: "targets", steps: [{ id: "trade", label: "Trade", duration: "2s", scene: {} }] },
      render(ctx) {
        const id = ctx.data.projection.title;
        const answer = ctx.scene.node(id, { actions: ["explain"] });
        return Html({ width: "fill", height: "fill", html: `<button ${answer.attrs} style="pointer-events:none">${id}</button>` });
      },
    });
    await controller.load(media, { data: live("First") });
    const doc = host.querySelector("iframe")!.contentDocument!;
    const query = vi.spyOn(doc, "querySelectorAll");
    const attach = vi.spyOn(doc, "addEventListener");
    const actions: unknown[] = [];
    controller.on("action", (event) => actions.push(event));
    await controller.player.seek({ frame: 5 });
    await controller.player.seek({ frame: 6 });
    await controller.setData(live("New target"));
    expect(query.mock.calls.some(([selector]) => selector === "[data-si-actions]")).toBe(false);
    expect(attach.mock.calls.some(([type]) => type === "click")).toBe(false);
    expect(doc.querySelectorAll("style[data-superimg-action-policy]")).toHaveLength(1);
    const button = doc.querySelector<HTMLButtonElement>("button")!;
    expect(doc.defaultView!.getComputedStyle(button).pointerEvents).toBe("auto");
    button.click();
    expect(actions).toMatchObject([{ nodeId: "New target", action: "explain" }]);
    controller.dispose();
  });

  it("installs the committed runtime before publishing a reentrant scene mutation", async () => {
    const { controller } = mountController();
    const media = defineInteractive<LiveData>({
      guide: { id: "reentrant", steps: [{ id: "start", label: "Start", duration: "1s", scene: {} }] },
      render(ctx) {
        ctx.scene.states({ selected: {} });
        return Html({ width: "fill", height: "fill", html: "Ready" });
      },
    });
    let mutation: Promise<void> | undefined;
    const unsubscribe = controller.on("sceneupdate", () => {
      unsubscribe();
      mutation = controller.scene.use("selected");
    });
    await controller.load(media, { data: live("First") });
    await mutation;
    expect(controller.sceneSnapshot.activeState).toBe("selected");
    controller.dispose();
  });

  it("does not publish the previous guide's step during replacement acceptance", async () => {
    const { controller } = mountController();
    const make = (prefix: string) => defineInteractive<LiveData>({
      guide: { id: prefix, steps: ["one", "two"].map((suffix) => ({ id: `${prefix}-${suffix}`, label: suffix, duration: "1s", scene: {} })) },
      render: () => Html({ width: "fill", height: "fill", html: prefix }),
    });
    await controller.load(make("old"), { data: live("First") });
    await controller.guide.goToStep("old-two");
    const steps: string[] = [];
    controller.on("stepchange", (step) => steps.push(step!.stepId));
    await controller.load(make("new"), { data: live("Next") });
    expect(steps).toEqual(["new-one"]);
    controller.dispose();
  });

  it("withholds native callbacks until controller bookkeeping matches the committed Player", async () => {
    const { host, controller } = mountController();
    const actions: unknown[] = [];
    controller.on("action", (event) => actions.push(event));
    controller.player.on("ready", () => host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click());
    await controller.load(buttonMedia(), { data: live("First") });
    expect(actions).toEqual([]);
    host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click();
    expect(actions).toHaveLength(1);
    controller.dispose();
  });

  it("keeps semantics accepted and suppresses a same-frame action while new DOM is pending", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const first = controller.sceneSnapshot;
    const scenes: string[] = [];
    const actions: unknown[] = [];
    controller.on("sceneupdate", (scene) => scenes.push(String(scene.nodes[0]?.metadata.revision)));
    controller.on("action", (event) => actions.push(event));
    let release!: () => void;
    const original = IframePresenter.prototype.present;
    vi.spyOn(IframePresenter.prototype, "present").mockImplementation(async function (...args) {
      await original.apply(this, args);
      await new Promise<void>((resolve) => { release = resolve; });
    });
    const pending = controller.setData(live("Next"));
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(controller.player.getPresentation()).toMatchObject({ isPending: true, requestedFrame: 0 });
    expect(controller.sceneSnapshot).toBe(first);
    expect(scenes).toEqual([]);
    host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click();
    expect(actions).toEqual([]);
    vi.restoreAllMocks();
    release();
    await pending;
    expect(scenes).toEqual(["Next"]);
    expect(controller.sceneSnapshot.nodes[0]?.metadata.revision).toBe("Next");
    host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click();
    expect(actions).toHaveLength(1);
    controller.dispose();
  });

  it("rejects undeclared or hidden targets rather than trusting DOM action attributes", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const actions: unknown[] = [];
    controller.on("action", (event) => actions.push(event));
    const doc = host.querySelector("iframe")!.contentDocument!;
    const button = doc.querySelector("button")!;
    button.setAttribute("data-si-actions", "spend");
    button.click();
    expect(actions).toEqual([]);
    await controller.scene.hide("answer");
    doc.querySelector("button")!.click();
    expect(actions).toEqual([]);
    controller.dispose();
  });

  it("leaves the last accepted session usable when an invalid interactive replacement fails", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const before = controller.player.getPresentation();
    const scene = controller.sceneSnapshot;
    const invalid = defineInteractive<LiveData>({
      guide: { id: "invalid", steps: [{ id: "bad", label: "Bad", duration: "1s", scene: {}, focusNodeId: "missing" }] },
      render: () => Html({ width: "fill", height: "fill", html: "INVALID" }),
    });
    const result = await controller.load(invalid, { data: live("Bad") });
    expect(result).toMatchObject({ status: "error", errorType: "validation" });
    expect(controller.player.getPresentation()).toEqual(before);
    expect(controller.sceneSnapshot).toBe(scene);
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("First");
    await controller.setData(live("Still usable"));
    expect(controller.sceneSnapshot.nodes[0]?.metadata.revision).toBe("Still usable");
    controller.dispose();
  });

  it("forwards host assets/resolver/fonts and preserves them while replacing nested data", async () => {
    const { host, controller } = mountController();
    const media = defineInteractive<LiveData>({
      guide: { id: "resources", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>${ctx.data.projection.title}:${ctx.data.projection.reaction ?? "none"}</p><img src="${ctx.asset("badge.svg")}"><small>${ctx.assets.badge?.url ?? "missing"}</small>` }),
    });
    const result = await controller.load(media, {
      data: { projection: { title: "First", revision: "1", reaction: "old" } },
      assets: { badge: { type: "image", url: "/host/meta.svg", width: 1, height: 1, mimeType: "image/svg+xml", size: 1 } },
      assetResolver: (name) => `/host/${name}`,
      fonts: { css: "p{color:rgb(11, 22, 33)}" },
    });
    expect(result.status).toBe("success");
    await controller.setData(live("Next"));
    const doc = host.querySelector("iframe")!.contentDocument!;
    expect(doc.querySelector("img")?.getAttribute("src")).toBe("/host/badge.svg");
    expect(doc.body.textContent).toContain("/host/meta.svg");
    expect(doc.body.textContent).toContain("Next:none");
    expect(doc.head.textContent).toContain("rgb(11, 22, 33)");
    controller.dispose();
  });

  it("preserves root data patch compatibility, replaces nested records and keeps user input fields clean", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const controller = createInteractivePlayer<{ input: string; optional?: string; nested: { a?: number; b?: number } }>({ container: host });
    const seen: unknown[] = [];
    const media = defineInteractive<{ input: string; optional?: string; nested: { a?: number; b?: number } }>({
      sample: { input: "sample", optional: "default", nested: { a: 1 } },
      guide: { id: "patch", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) { seen.push(ctx.data); return Html({ width: "fill", height: "fill", html: JSON.stringify(ctx.data) }); },
    });
    await controller.load(media, { data: { input: "user", optional: "kept", nested: { a: 2 } } });
    await controller.setData({ input: "next", nested: { b: 3 } });
    expect(seen.at(-1)).toEqual({ input: "next", optional: "kept", nested: { b: 3 } });
    expect(Object.keys(seen.at(-1) as object)).toEqual(["input", "optional", "nested"]);
    controller.dispose();
  });

  it("resets old scene attempts only after a successful definition replacement", async () => {
    const { controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    await controller.scene.set("answer", { opacity: 0.3 });
    await controller.scene.camera({ zoom: 2 });
    await controller.load(buttonMedia(), { data: live("Second") });
    expect(controller.sceneSnapshot.camera.zoom).toBe(1);
    await controller.scene.camera({ rotation: 5 });
    expect(controller.sceneSnapshot.camera.zoom).toBe(1);
    expect(controller.scene.get("answer")?.opacity).toBe(1);
    controller.dispose();
  });

  it("updates style and size on the same session while preserving scene, camera and overrides", async () => {
    const { host, controller } = mountController();
    const renderer: SceneStyleRenderer = { id: "test-renderer", render: ({ html, style }) => `<section data-style="${style}">${html}</section>` };
    await controller.load(buttonMedia(), { data: live("First"), sceneRenderer: renderer, sceneStyle: "first" });
    await controller.scene.set("answer", { opacity: 0.4 });
    await controller.scene.camera({ zoom: 1.3 });
    const iframe = host.querySelector("iframe");
    await controller.player.seek({ frame: 12 });
    const generation = controller.player.getPresentation().generation;
    await controller.update({ data: live("Next"), size: { width: 640, height: 480 }, sceneStyle: "next" });
    expect(host.querySelector("iframe")).toBe(iframe);
    expect(controller.player.getPresentation()).toMatchObject({ generation, accepted: { frame: 12 } });
    expect(controller.sceneSnapshot.camera.zoom).toBe(1.3);
    expect(controller.scene.get("answer")?.opacity).toBe(0.4);
    expect(iframe!.contentDocument!.querySelector("[data-style]")?.getAttribute("data-style")).toBe("next");
    expect(iframe!.contentDocument!.getElementById("scale-wrapper")?.style.width).toBe("640px");
    await controller.update({ sceneStyle: undefined });
    expect(iframe!.contentDocument!.querySelector("[data-style]")?.getAttribute("data-style")).toBe("undefined");
    controller.dispose();
  });

  it("does not let a rejected style/data candidate poison later clock frames or recovery", async () => {
    const { host, controller } = mountController();
    const renderer: SceneStyleRenderer = { id: "test-renderer", render: ({ html, style }) => {
      if (style === "bad") throw new Error("bad style");
      return `<section data-style="${style}">${html}</section>`;
    } };
    await controller.load(buttonMedia(), { data: live("First"), sceneRenderer: renderer, sceneStyle: "good" });
    await controller.scene.camera({ zoom: 1.4 });
    const iframe = host.querySelector("iframe")!;
    const scene = controller.sceneSnapshot;
    await expect(controller.update({ data: live("Rejected"), sceneStyle: "bad", size: { width: 900, height: 900 } })).rejects.toThrow("bad style");
    expect(controller.sceneSnapshot).toBe(scene);
    await controller.player.seek({ frame: 5 });
    expect(iframe.contentDocument!.body.textContent).toContain("First");
    expect(iframe.contentDocument!.querySelector("[data-style]")?.getAttribute("data-style")).toBe("good");
    await controller.update({ sceneStyle: "recovered" });
    expect(controller.sceneSnapshot.camera.zoom).toBe(1.4);
    expect(iframe.contentDocument!.body.textContent).not.toContain("Rejected");
    expect(iframe.contentDocument!.querySelector("[data-style]")?.getAttribute("data-style")).toBe("recovered");
    controller.dispose();
  });

  it("retains attempted scene commands after failure without poisoning accepted clock frames", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    await expect(controller.scene.hide("missing")).rejects.toThrow("missing");
    await controller.player.seek({ frame: 4 });
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("First");
    await expect(controller.scene.camera({ zoom: 2 })).rejects.toThrow("missing");
    await controller.scene.reset();
    expect(controller.sceneSnapshot.camera.zoom).toBe(1);
    controller.dispose();
  });

  it("retains scene command history if a definition replacement fails", async () => {
    const { controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    await controller.scene.set("answer", { opacity: 0.4 });
    await controller.scene.camera({ zoom: 1.4 });
    const invalid = defineInteractive<LiveData>({
      guide: { id: "bad", steps: [{ id: "one", label: "One", duration: "1s", scene: {}, focusNodeId: "missing" }] },
      render: () => Html({ width: "fill", height: "fill", html: "bad" }),
    });
    expect((await controller.load(invalid, { data: live("bad") })).status).toBe("error");
    await controller.scene.camera({ rotation: 2 });
    expect(controller.sceneSnapshot.camera.zoom).toBe(1.4);
    expect(controller.scene.get("answer")?.opacity).toBe(0.4);
    controller.dispose();
  });

  it("captures interleaved updates and scene commands and rejects superseded acceptance", async () => {
    const { controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const first = controller.update({ data: live("Newest"), size: { width: 640, height: 480 } });
    const rejected = expect(first).rejects.toThrow(/superseded/);
    const second = controller.scene.camera({ zoom: 1.5 });
    await Promise.all([rejected, second]);
    expect(controller.sceneSnapshot.camera.zoom).toBe(1.5);
    expect(controller.sceneSnapshot.nodes[0]?.metadata.revision).toBe("Newest");
    expect(controller.player.getPresentation().accepted?.html).toBeDefined();
    expect(controller.player.store.getState()).toMatchObject({ width: 640, height: 480 });
    controller.dispose();
  });

  it("keeps the just-accepted input when a reentrant newer update fails", async () => {
    const { host, controller } = mountController();
    const renderer: SceneStyleRenderer = { id: "reentrant", render: ({ html, style }) => {
      if (style === "bad") throw new Error("bad reentrant style");
      return html;
    } };
    await controller.load(buttonMedia(), { data: live("First"), sceneRenderer: renderer });
    let recovery: Promise<unknown> | undefined;
    const unsubscribe = controller.on("sceneupdate", () => {
      unsubscribe();
      recovery = controller.update({ sceneStyle: "bad" }).catch(error => error);
    });
    await controller.setData(live("Accepted"));
    expect(await recovery).toBeInstanceOf(Error);
    await controller.scene.camera({ zoom: 1.3 });
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("Accepted");
    controller.dispose();
  });

  it("lets guide seeks supersede pending data without accepting or retaining that candidate", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    let release: (() => void) | undefined;
    const original = IframePresenter.prototype.present;
    let first = true;
    vi.spyOn(IframePresenter.prototype, "present").mockImplementation(async function (...args) {
      await original.apply(this, args);
      if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
    });
    const update = controller.setData(live("Interrupted"));
    const rejected = expect(update).rejects.toThrow(/superseded/);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const seek = controller.guide.goToStep("trade");
    release!();
    await Promise.all([rejected, seek]);
    await controller.scene.camera({ zoom: 1.2 });
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("First");
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).not.toContain("Interrupted");
    controller.dispose();
  });

  it("retains sample defaults without exposing or mutating the private envelope", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const controller = createInteractivePlayer<{ input?: string; count?: number }>({ container: host });
    const seen: unknown[] = [];
    const media = defineInteractive<{ input?: string; count?: number }>({
      sample: { input: "user-sample", count: 1 },
      guide: { id: "defaults", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) {
        ctx.data.count = (ctx.data.count ?? 0) + 1;
        seen.push({ ...ctx.data });
        return Html({ width: "fill", height: "fill", html: String(ctx.data.count) });
      },
    });
    await controller.load(media, { data: {} });
    await controller.player.seek({ frame: 3 });
    expect(seen).toEqual([{ input: "user-sample", count: 2 }, { input: "user-sample", count: 2 }]);
    expect(media.sample).toEqual({ input: "user-sample", count: 1 });
    controller.dispose();
  });

  it("reconciles error-callback recovery against accepted input before notifying observers", async () => {
    const { host, controller } = mountController();
    const renderer: SceneStyleRenderer = { id: "error-recovery", render: ({ html, style }) => {
      if (style === "bad") throw new Error("bad style");
      return html;
    } };
    await controller.load(buttonMedia(), { data: live("First"), sceneRenderer: renderer, sceneStyle: "good" });
    let recovery: Promise<unknown> | undefined;
    const unsubscribe = controller.on("error", () => {
      unsubscribe();
      recovery = controller.update({ sceneStyle: "recovered" }).catch(error => error);
    });
    await expect(controller.update({ data: live("Rejected"), sceneStyle: "bad" })).rejects.toThrow("bad style");
    expect(await recovery).toBeUndefined();
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("First");
    controller.dispose();
  });

  it("keeps typed supersession for concurrent scene-command acceptance", async () => {
    const { controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    const first = controller.scene.camera({ zoom: 1.2 });
    const rejected = expect(first).rejects.toMatchObject({ code: "PLAYER_PRESENTATION_SUPERSEDED" });
    const second = controller.scene.camera({ rotation: 3 });
    await Promise.all([rejected, second]);
    expect(controller.sceneSnapshot.camera).toMatchObject({ zoom: 1.2, rotation: 3 });
    controller.dispose();
  });

  it("does not classify authored supersession-looking errors as interrupted commands", async () => {
    const { controller } = mountController();
    const authoredError = new Error("MediaSession update was superseded by a newer request.");
    const media = defineInteractive<LiveData>({
      guide: { id: "error", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) {
        ctx.scene.node("answer");
        if (ctx.scene.snapshot().camera.zoom === 2) throw authoredError;
        return Html({ width: "fill", height: "fill", html: "Ready" });
      },
    });
    await controller.load(media, { data: live("First") });
    await expect(controller.scene.camera({ zoom: 2 })).rejects.toBe(authoredError);
    controller.dispose();
  });

  it("binds accepted input before a public store subscriber starts a failing newer request", async () => {
    const { host, controller } = mountController();
    const renderer: SceneStyleRenderer = { id: "store-reentry", render: ({ html, style }) => {
      if (style === "bad") throw new Error("bad subscriber style");
      return html;
    } };
    await controller.load(buttonMedia(), { data: live("First"), sceneRenderer: renderer, sceneStyle: "good" });
    let newer: Promise<unknown> | undefined;
    const unsubscribe = controller.player.subscribe(() => {
      if (controller.sceneSnapshot.nodes[0]?.metadata.revision !== "Accepted A") return;
      unsubscribe();
      newer = controller.update({ data: live("Rejected B"), sceneStyle: "bad" }).catch(error => error);
    });
    await controller.setData(live("Accepted A"));
    expect(await newer).toBeInstanceOf(Error);
    await controller.update({ sceneStyle: "recovered" });
    await controller.scene.camera({ zoom: 1.3 });
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("Accepted A");
    expect(controller.sceneSnapshot.nodes[0]?.metadata.revision).toBe("Accepted A");
    controller.dispose();
  });

  it("keeps accepted input for error recovery when a public store subscriber throws", async () => {
    const { host, controller } = mountController();
    await controller.load(buttonMedia(), { data: live("First") });
    let recovery: Promise<unknown> | undefined;
    const offError = controller.on("error", () => {
      offError();
      recovery = controller.update({ sceneStyle: "recovered" }).catch(error => error);
    });
    const unsubscribe = controller.player.subscribe(() => {
      if (controller.sceneSnapshot.nodes[0]?.metadata.revision !== "Accepted A") return;
      unsubscribe();
      throw new Error("subscriber failed after acceptance");
    });
    await controller.setData(live("Accepted A"));
    expect(await recovery).toBeUndefined();
    await controller.scene.camera({ zoom: 1.2 });
    expect(host.querySelector("iframe")!.contentDocument!.body.textContent).toContain("Accepted A");
    controller.dispose();
  });

});
