import "./style.css";
import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";
import { createPreviewInspection, type PreviewSnapshot } from "@foxworth/superimg/inspection";
import { createPreviewInteractionMount } from "@foxworth/superimg/inspection/boundary";
import { isWebMcpAvailable, registerWebMcpBinding, webMcpTools } from "@foxworth/boundary/webmcp";
import { fps, size, story } from "./story.js";
import storySource from "./story.ts?raw";
import hostSource from "./main.ts?raw";
import styleSource from "./style.css?raw";

const surfaceId = "story";
const player = new Player({ container: "#player", size, playbackMode: "loop", hoverBehavior: "none" });
const presentation = present(player, story, {
  mode: "timeline", size, fps, routes: { chapter: "calm" }, inspection: true,
});
const inspection = createPreviewInspection({ readinessTimeoutMs: 5_000 });
const status = document.querySelector<HTMLElement>("#status")!;
const snapshot = document.querySelector<HTMLElement>("#snapshot")!;
const transport = document.querySelector<HTMLElement>("#transport")!;
const form = document.querySelector<HTMLFormElement>("#controls")!;
const fields = form.querySelector<HTMLFieldSetElement>("fieldset")!;
const frameInput = document.querySelector<HTMLInputElement>("#frame")!;
const route = document.querySelector<HTMLSelectElement>("#route")!;
const allowAgent = document.querySelector<HTMLInputElement>("#allow-agent")!;
const withdraw = document.querySelector<HTMLButtonElement>("#withdraw")!;
let mount: { dispose(): void } | undefined;
let registration: { dispose(): void } | undefined;
let attached: { dispose(): void } | undefined;
let disposed = false;

declare global { interface Window { superimgInspection?: typeof inspection } }

function show(value: PreviewSnapshot) {
  snapshot.textContent = JSON.stringify(value, null, 2);
  status.textContent = `Presented frame ${value.presented?.frame ?? "—"} / ${value.totalFrames - 1} · ${value.clock.owner} · resources ${value.readiness.status} · generation ${value.generation} / revision ${value.presented?.revision ?? "—"}`;
  route.value = value.routes.chapter ?? "calm";
}

function displayControl<Input>(operation: (input: Input) => Promise<PreviewSnapshot>) {
  return async (input: Input) => {
    const value = await operation(input);
    if (!disposed) show(value);
    return value;
  };
}

// Agent controls and ordinary form controls share the same visible accepted state.
const observedInspection = {
  ...inspection,
  setMode: displayControl(inspection.setMode),
  seek: displayControl(inspection.seek),
  selectPart: displayControl(inspection.selectPart),
  selectRoute: displayControl(inspection.selectRoute),
  selectStep: displayControl(inspection.selectStep),
};

async function select(action: (target: { surfaceId: string; expectedGeneration: number }) => Promise<PreviewSnapshot>) {
  fields.disabled = true;
  status.textContent = "Waiting for the accepted frame and its resources…";
  try {
    const before = await inspection.inspect({ surfaceId });
    const owned = await inspection.setMode({ surfaceId, expectedGeneration: before.generation, mode: "inspection" });
    show(await action({ surfaceId, expectedGeneration: owned.generation }));
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally { fields.disabled = disposed; }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void select((target) => inspection.seek({ ...target, frame: frameInput.valueAsNumber }));
});
document.querySelector("#select-part")!.addEventListener("click", () => {
  void select((target) => inspection.selectPart({ ...target, partId: "chapter" }));
});
route.addEventListener("change", () => {
  const selection = route.value;
  void select((target) => inspection.selectRoute({ ...target, path: "chapter", selection }));
});
document.querySelector("#live")!.addEventListener("click", async () => {
  try {
    const before = await inspection.inspect({ surfaceId });
    show(await inspection.setMode({ surfaceId, expectedGeneration: before.generation, mode: "live" }));
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});

function withdrawTools() {
  registration?.dispose();
  registration = undefined;
  mount?.dispose();
  mount = undefined;
  withdraw.disabled = true;
  transport.textContent = "Tools withdrawn. JavaScript inspection remains available.";
}
withdraw.addEventListener("click", withdrawTools);

async function init() {
  const result = await presentation.ready;
  if (result.status !== "success") throw new Error(result.message);
  // Identifies these bundled host inputs; it is not a hash of SuperImg's library build.
  const sourceDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([storySource, hostSource, styleSource])));
  const sourceRevision = `host-source-sha256:${Array.from(new Uint8Array(sourceDigest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  if (disposed) return;
  attached = inspection.attach({
    surfaceId, player, presentation,
    source: { id: "agent-inspection/story", revision: sourceRevision },
    coordinates: { entryId: null, variantId: "default", editionId: "default" },
    controls: ["set-mode", "seek-frame", "select-part", "select-route"],
  });
  window.superimgInspection = observedInspection;
  fields.disabled = false;
  show(await inspection.inspect({ surfaceId }));

  if (!isWebMcpAvailable()) {
    withdraw.disabled = true;
    allowAgent.disabled = true;
    transport.textContent = "WebMCP is unavailable in this browser. Use the JavaScript inspection API.";
    return;
  }

  // Admission reads host-created context on every invocation. Tool inputs do not grant authority.
  const callerMount = await createPreviewInteractionMount<{ mayInspect: boolean; signal: AbortSignal }>({
    inspection: observedInspection, installationId: "agent-inspection-preview",
    allowedSurfaces: [surfaceId],
    expose: ["list", "inspect", "setMode", "seekFrame", "selectPart", "selectRoute"],
    admit: ({ context }) => context.mayInspect && !context.signal.aborted
      ? { decision: "allow" }
      : { decision: "deny", reason: "Preview tools are disabled by the host" },
  });
  if (disposed) { callerMount.dispose(); return; }
  mount = callerMount;
  try {
    const registered = await registerWebMcpBinding({
      binding: callerMount.binding, tools: webMcpTools(callerMount.projection),
      context: ({ signal }) => ({ mayInspect: allowAgent.checked, signal }),
    });
    if (disposed || !mount) { registered.dispose(); return; }
    registration = registered;
    transport.textContent = `${registered.tools.length} WebMCP tools registered. The host admits only this story surface.`;
  } catch (error) {
    withdrawTools();
    transport.textContent = `WebMCP registration failed: ${error instanceof Error ? error.message : String(error)}. JavaScript inspection remains available.`;
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  withdrawTools();
  attached?.dispose();
  inspection.dispose();
  presentation.dispose();
  player.dispose();
  if (window.superimgInspection === observedInspection) delete window.superimgInspection;
}
window.addEventListener("pagehide", dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
void init().catch((error) => { status.textContent = error instanceof Error ? error.message : String(error); });
