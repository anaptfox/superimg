import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";
import { createPreviewInspection } from "@foxworth/superimg/inspection";
import { createPreviewInteractionMount } from "@foxworth/superimg/inspection/boundary";
import { isWebMcpAvailable, registerWebMcpBinding, webMcpTools } from "@foxworth/boundary/webmcp";
import { prepareProgram } from "@foxworth/superimg/composition/prepare";
import { InteractivePlayerController } from "@foxworth/superimg/interactive/player";
import { time } from "@foxworth/superimg";
import { colors, fixtureProgram, lesson, size, still } from "./programs.js";

const caseName = new URL(location.href).searchParams.get("case") ?? "seven";
const primary = document.querySelector<HTMLElement>("#primary")!;
const secondary = document.querySelector<HTMLElement>("#secondary")!;
const inspection = createPreviewInspection({ readinessTimeoutMs: caseName.includes("timeout") ? 250 : 5000 });
const disposers: Array<() => void> = [];
const actions: unknown[] = [];
const pointerEvents: Array<{ type: string; trusted: boolean }> = [];
const preparations: Array<{ routes: unknown; resolvedAsset?: string }> = [];
const sdkExecutions: unknown[] = [];
function visibleDocument(surfaceId = "primary"): Document {
  const container = document.getElementById(surfaceId)!;
  const frame = Array.from(container.querySelectorAll("iframe")).find((candidate) => getComputedStyle(candidate).visibility !== "hidden" && candidate.contentDocument?.getElementById("root"));
  if (!frame?.contentDocument) throw new Error(`No committed visible iframe for ${surfaceId}`);
  return frame.contentDocument;
}
for (const type of ["pointerdown", "pointercancel"]) primary.addEventListener(type, (event) => pointerEvents.push({ type: event.type, trusted: event.isTrusted }));
let loads = 0;

try {
  let player: Player;
  let controller: InteractivePlayerController<{ selected: boolean }> | undefined;
  let presentation: ReturnType<typeof present> | undefined;
  const original = fixtureProgram(caseName === "isolation-pending" ? "resource-timeout" : caseName);
  const routes = caseName === "branch" ? { branch: "basic" } : {};
  const prepared = await prepareProgram(original, { size, fps: 25, routes });
  if (caseName === "lesson") {
    controller = new InteractivePlayerController({ container: primary });
    player = controller.player;
    const loaded = await controller.load(lesson, { data: { selected: false } });
    if (loaded.status !== "success") throw new Error(`Lesson load failed: ${JSON.stringify(loaded)}`);
    controller.on("action", (event) => { actions.push(event); void controller!.setData({ selected: true }); });
    disposers.push(() => controller!.dispose());
  } else {
    player = new Player({ container: primary, ...(caseName === "scroll" || caseName === "pointer" ? { drive: caseName } : {}), ...(caseName.startsWith("canvas") ? { playerMode: "dev" } : {}) });
    presentation = present(player, prepared.program, {
      mode: caseName === "manual" || caseName === "moving" ? "manual" : "timeline", size, fps: 25, routes, inspection: true,
      ...(caseName === "resource-stylesheet" ? { loadOptions: { fonts: { stylesheets: [new URL("/asset.css?delay=1000&frame=0", location.href).href] } } } : {}),
      ...(caseName === "branch" ? {
        loadOptions: { assetResolver: (name: string) => new URL(name.endsWith("/source") || name === "source" ? "/asset.mp4" : `/fixture-assets/${name}`, location.href).href },
        prepare: async (_media, context) => {
          preparations.push({ routes: context.routes, resolvedAsset: context.loadOptions?.assetResolver?.("route.png") });
          const candidate = await prepareProgram(original, { size, fps: 25, routes: context.routes });
          return { media: time(candidate.program, { size, fps: 25, routes: context.routes, inspection: true }), loadOptions: context.loadOptions };
        },
      } : {}),
    });
    const loaded = await presentation.ready;
    if (loaded.status !== "success") throw new Error(`Program load failed: ${JSON.stringify(loaded)}`);
    disposers.push(() => { presentation!.dispose(); player.dispose(); });
  }
  player.on("ready", () => loads++);
  const attached = inspection.attach({
    surfaceId: "primary", player, ...(presentation ? { presentation } : {}),
    ...(controller ? { interactive: controller } : {}),
    source: { id: `fixture:${caseName}`, revision: "v1" },
    controls: ["set-mode", "seek-frame", "select-part", "select-route", "select-step"],
    ...(caseName === "canvas-sidecar" ? { sidecar: () => ({
      semantic: { suppliedBy: "fixture-host", paint: "orange" },
      nodes: [{ id: "orange-target", occurrence: "canvas", kind: "canvas-sidecar", actions: [], sceneId: null, bounds: { x: 0, y: 0, width: 320, height: 180 }, authoredBounds: { x: 0, y: 0, width: 320, height: 180 } }],
    }) } : {}),
  });
  if (caseName.startsWith("isolation")) {
    const other = new Player({ container: secondary });
    const loaded = await other.load(still("SECONDARY", colors.green));
    if (loaded.status !== "success") throw new Error("Secondary fixture did not load");
    const attachedOther = inspection.attach({ surfaceId: "secondary", player: other, controls: ["set-mode", "seek-frame"] });
    disposers.push(() => { attachedOther.dispose(); other.dispose(); });
  }
  let role = "owner";
  const mount = await createPreviewInteractionMount({
    inspection, installationId: `fixture:preview:${caseName}:v1`,
    expose: ["list", "inspect", "setMode", "seekFrame", "selectPart", "selectRoute", "selectStep"],
    ...(caseName === "isolation-scoped" ? { allowedSurfaces: ["primary"] } : {}),
    admit: ({ context, handle }) => {
      const trusted = context as { role: string };
      return trusted.role === "owner" || ["media.preview.list", "media.preview.inspect"].includes(handle.interactionId)
        ? { decision: "allow" } : { decision: "deny", reason: "Viewer may only inspect" };
    },
  });
  const available = isWebMcpAvailable();
  // Observe the real browser registration without changing SDK results or transport.
  if (available) {
    const modelContext = (document as Document & { modelContext: { registerTool(tool: { name: string; execute: (...args: unknown[]) => Promise<unknown> }, ...options: unknown[]): unknown } }).modelContext;
    const registerTool = modelContext.registerTool.bind(modelContext);
    modelContext.registerTool = (tool, ...options) => registerTool({ ...tool, execute: async (...args) => {
      const started = performance.now();
      try { const outcome = await tool.execute(...args); sdkExecutions.push({ tool: tool.name, started, completed: performance.now(), outcome }); return outcome; }
      catch (error) { sdkExecutions.push({ tool: tool.name, started, rejected: performance.now(), error: String(error) }); throw error; }
    } }, ...options);
  }
  const registration = available ? await registerWebMcpBinding({ binding: mount.binding, tools: webMcpTools(mount.projection), context: () => ({ role }) }) : undefined;
  disposers.push(() => { registration?.dispose(); mount.dispose(); });
  Object.assign(window, {
    __inspectionFixture: {
      inspection,
      document: visibleDocument,
      available,
      setRole: (next: string) => { role = next; },
      withdraw: () => registration?.dispose(),
      revoke: () => mount.controller.revoke(),
      bindingInspect: (surfaceId: string) => mount.binding.connect().call(mount.projection.handles.inspect, { surfaceId }, { role }),
      bindingSelectRoute: (input: { surfaceId: string; path: string; selection: string; expectedGeneration: number }) => mount.binding.connect().call(mount.projection.handles.selectRoute, input, { role }),
      actions: () => [...actions],
      pointerEvents: () => [...pointerEvents],
      preparations: () => [...preparations],
      sdkExecutions: () => [...sdkExecutions],
      loads: () => loads,
      restartStylesheet: () => { const link = visibleDocument().querySelector<HTMLLinkElement>('link[data-superimg-media-style="stylesheet"]')!; link.href = new URL("/asset.css?delay=1000&frame=1", location.href).href; },
      rawPresentation: () => player.getPresentation(),
      reload: () => player.load(time(prepared.program, { size, fps: 25, routes })),
      disposePrimary: () => { attached.dispose(); player.dispose(); },
      dispose: () => { inspection.dispose(); for (const dispose of disposers.splice(0)) dispose(); },
    },
  });
  document.body.dataset.ready = "success";
} catch (error) {
  document.body.dataset.ready = "error";
  document.body.dataset.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
}
