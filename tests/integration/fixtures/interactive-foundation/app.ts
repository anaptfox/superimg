import { Html } from "@foxworth/superimg";
import { createInteractivePlayer, type InteractiveLoadOptions } from "@foxworth/superimg/interactive/player";
import { defineInteractive, type InteractiveRenderContext, type SceneActionEvent, type SceneSnapshot } from "@foxworth/superimg/interactive/define";
import { createPreviewInspection } from "@foxworth/superimg/inspection";

type Projection = {
  label: string;
  customerId: string;
  font: string;
  selected: boolean;
};
type Data = { projection: Projection };
type InstanceId = "left" | "right";

const size = { width: 420, height: 220 };
const lesson = defineInteractive<Data>({
  size,
  guide: {
    id: "foundation",
    steps: [
      { id: "morning", label: "Morning", duration: "2s", scene: { state: "morning" } },
      { id: "trading", label: "Trading", duration: "2s", scene: { state: "trading" } },
    ],
  },
  render(ctx) {
    const { projection } = ctx.data;
    ctx.scene.states({ morning: {}, trading: {} });
    ctx.scene.use("morning");
    const reaction = ctx.scene.node(`reaction:${projection.customerId}`, {
      role: "reaction",
      label: projection.label,
      actions: ["explain-reaction"],
      metadata: { customerId: projection.customerId, label: projection.label },
    });
    const badge = ctx.assets.badge;
    return Html({
      width: "fill",
      height: "fill",
      html: `<main style="box-sizing:border-box;width:100%;height:100%;padding:18px;background:#f8f0d2;color:#243c2c;font:28px '${projection.font}',monospace">
        <span id="font-probe">iiiiWWWW</span>
        <div id="label">${projection.label}</div>
        <img id="badge" alt="Caller supplied badge" width="80" height="40" src="${ctx.asset("badge")}">
        <span id="asset-width">${badge?.type === "image" ? badge.width : "missing"}</span>
        <button id="reaction" ${reaction.attrs}>Explain ${projection.customerId}</button>
        <output id="frame">${ctx.timeline.frame}</output>
        <output id="selected">${projection.selected}</output>
      </main>`,
    });
  },
});

const broken = defineInteractive<Data>({
  size,
  guide: { id: "invalid", steps: [{ id: "absent", label: "Invalid", duration: "1s", scene: {}, focusNodeId: "absent" }] },
  render() { return Html({ width: "fill", height: "fill", html: "Invalid replacement" }); },
});

// Deliberately aliased/computed access: preparing these packs must consume the
// compiler/host stamp rather than guessing from renderer Function#toString.
const capabilityRender = (c: InteractiveRenderContext<Data>) => {
  const s = c.std;
  const m = s[["ma", "th"].join("") as "math"];
  const v = s[["s", "vg"].join("") as "svg"];
  const value = m.clamp(c.data.projection.selected ? 3 : -2, 0, 1);
  const radius = 8 + value * 16;
  c.scene.states({ morning: {}, trading: {} });
  c.scene.use("morning");
  const target = c.scene.node(`reaction:${c.data.projection.customerId}`, {
    role: "reaction",
    actions: ["explain-reaction"],
    metadata: { label: c.data.projection.label, customerId: c.data.projection.customerId, packValue: value },
  });
  return Html({
    width: "fill", height: "fill",
    html: `<main style="width:100%;height:100%;background:#f8f0d2;padding:18px;box-sizing:border-box">
      <div id="label">${c.data.projection.label}</div>
      <output id="capability-value">${value}</output>
      <svg width="80" height="80" viewBox="0 0 80 80"><path id="capability-shape" d="${v.shape.circle(40, 40, radius)}" fill="#e43280"/></svg>
      <button id="reaction" ${target.attrs}>Explain ${c.data.projection.customerId}</button>
    </main>`,
  });
};
const capabilityDefinition = {
  ...defineInteractive<Data>({ size, guide: lesson.guide, render: capabilityRender }),
  mediaCapabilities: { version: 0 as const, names: ["math", "svg"] as const },
};
const emptyCapabilityDefinition = {
  ...defineInteractive<Data>({
    size, guide: lesson.guide,
    render(ctx) {
      // A discoverable access would prepare math if an explicit empty stamp
      // were incorrectly treated as absent and source inference took over.
      ctx.std.math.clamp(2, 0, 1);
      return capabilityRender(ctx);
    },
  }),
  mediaCapabilities: { version: 0 as const, names: [] },
};

const inspection = createPreviewInspection({ readinessTimeoutMs: 5000 });
const instances = new Map<InstanceId, {
  controller: ReturnType<typeof createInteractivePlayer<Data>>;
  detach(): void;
  data: Data;
  actions: SceneActionEvent[];
  scenes: SceneSnapshot[];
  disposed: boolean;
}>();
const outcomes: Array<{ id: InstanceId; label: string; status: string; message?: string }> = [];

function projection(label: string, key: string, selected = false): Data {
  return { projection: { label, customerId: label.toLowerCase().replace(/[^a-z0-9]/g, "-"), font: `CallerFont${key}`, selected } };
}

function options(data: Data, key: string): InteractiveLoadOptions<Data> {
  const fontUrl = new URL(`/font.woff2?key=${key}`, location.href).href;
  return {
    data,
    autoplay: false,
    fonts: { css: `@font-face{font-family:'${data.projection.font}';src:url('${fontUrl}') format('woff2');font-display:block}` },
    assets: { badge: { type: "image", url: new URL("/unused-badge.svg", location.href).href, mimeType: "image/svg+xml", size: 200, width: 80, height: 40 } },
    assetResolver: (name) => new URL(`/badge.svg?name=${encodeURIComponent(name)}&key=${key}`, location.href).href,
  };
}

async function load(id: InstanceId, label: string, key = "normal") {
  const instance = instances.get(id)!;
  const data = projection(label, key);
  instance.data = data;
  try {
    const result = await instance.controller.load(lesson, options(data, key));
    outcomes.push({ id, label, status: result.status, ...(result.status === "error" ? { message: result.message } : {}) });
    return result;
  } catch (error) {
    outcomes.push({ id, label, status: "rejected", message: String(error) });
    return { status: "rejected", message: String(error) };
  }
}

function state(id: InstanceId) {
  const instance = instances.get(id)!;
  const presentation = instance.controller.player.getPresentation();
  let scene: SceneSnapshot | null = null;
  try { scene = instance.controller.sceneSnapshot; } catch { /* Unready/disposed has no accepted scene. */ }
  return {
    presentation: {
      generation: presentation.generation,
      requestedFrame: presentation.requestedFrame,
      accepted: presentation.accepted ? { frame: presentation.accepted.frame, revision: presentation.accepted.revision } : null,
      isPending: presentation.isPending,
      isReady: presentation.isReady,
      disposed: presentation.disposed,
    },
    isPlaying: presentation.disposed ? false : instance.controller.player.getState().isPlaying,
    scene,
    step: instance.controller.guide.currentStep?.stepId ?? null,
    actions: [...instance.actions],
    scenes: [...instance.scenes],
    disposed: instance.disposed,
    outcomes: [...outcomes],
  };
}

function dispose(id: InstanceId) {
  const instance = instances.get(id)!;
  instance.detach();
  instance.controller.dispose();
  instance.disposed = true;
}

Object.assign(window, {
  __interactiveFoundation: {
    state,
    load,
    startLoad: (id: InstanceId, label: string, key: string) => { void load(id, label, key); },
    update: async (id: InstanceId, label: string, selected = true) => {
      const instance = instances.get(id)!;
      // setData is a top-level shallow patch: replace the complete projection.
      instance.data = { projection: { ...instance.data.projection, label, customerId: label.toLowerCase().replace(/[^a-z0-9]/g, "-"), selected } };
      await instance.controller.setData(instance.data);
    },
    invalid: (id: InstanceId) => {
      const instance = instances.get(id)!;
      return instance.controller.load(broken, options(instance.data, "normal"));
    },
    capabilities: (id: InstanceId, empty = false) => {
      const instance = instances.get(id)!;
      const data = projection("Capability", "normal");
      instance.data = data;
      return instance.controller.load(empty ? emptyCapabilityDefinition : capabilityDefinition, options(data, "normal"));
    },
    act: (id: InstanceId, step: string) => instances.get(id)!.controller.guide.goToStep(step),
    inspect: (id: InstanceId) => inspection.inspect({ surfaceId: id }),
    dispose,
    disposeAll: () => { for (const [id, instance] of instances) if (!instance.disposed) dispose(id); inspection.dispose(); },
  },
});

try {
  for (const id of ["left", "right"] as const) {
    const controller = createInteractivePlayer<Data>({ container: document.getElementById(id)!, autoplay: false });
    const actions: SceneActionEvent[] = [];
    const scenes: SceneSnapshot[] = [];
    const attached = inspection.attach({ surfaceId: id, player: controller.player, interactive: controller, source: { id: "fixture:interactive-foundation", revision: "v1" } });
    const removeAction = controller.on("action", (event) => actions.push(event));
    const removeScene = controller.on("sceneupdate", (scene) => scenes.push(scene));
    instances.set(id, { controller, actions, scenes, data: projection(id, "normal"), disposed: false, detach: () => { removeAction(); removeScene(); attached.dispose(); } });
    const result = await load(id, id === "left" ? "Alpha" : "Beta");
    if (result.status !== "success") throw new Error(JSON.stringify(result));
  }
  document.body.dataset.ready = "success";
} catch (error) {
  document.body.dataset.ready = "error";
  document.body.dataset.error = String(error);
}
