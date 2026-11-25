import "./style.css";
import { remainsUncertain, reconciledUncertainty } from "./outcome.js";

interface Part { id: string; label: string; editable: boolean; reason?: string; value?: { x: number; y: number } }
interface Inspection { revision: string; html: string; parts: Part[]; checks?: unknown; command?: unknown }
interface Revision { beforeHtml: string; afterHtml: string; changes?: unknown; checks?: unknown; command: unknown; sourceRevision: string }
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const edition = element<HTMLSelectElement>("edition");
const part = element<HTMLSelectElement>("part");
const x = element<HTMLInputElement>("x");
const y = element<HTMLInputElement>("y");
const preview = element<HTMLButtonElement>("preview");
const apply = element<HTMLButtonElement>("apply");
const status = element<HTMLDivElement>("status");
const undo = element<HTMLButtonElement>("undo");
const reconcile = element<HTMLButtonElement>("reconcile");
let inverseAvailable = false;
let preparedAvailable = false;
const rehearse = element<HTMLButtonElement>("rehearse");
const exportButton = element<HTMLButtonElement>("export");
let inspection: Inspection | undefined;
let candidate: Revision | undefined;
let busy = false;
let uncertain = false;
let uncertainSubject: "source" | "export" = "source";
const report = (id: string, value: unknown) => { element(id).textContent = JSON.stringify(value, null, 2); };
function say(message: string, state = "ready") { status.textContent = message; status.dataset.state = state; }
function buttons() {
  const selected = inspection?.parts.find((item) => item.id === part.value);
  preview.disabled = busy || uncertain || !selected?.editable;
  apply.disabled = busy || uncertain || !candidate;
  edition.disabled = busy;
  part.disabled = busy;
  rehearse.disabled = busy || uncertain;
  undo.disabled = busy || uncertain || !inverseAvailable;
  reconcile.disabled = busy;
  exportButton.disabled = busy || uncertain || !preparedAvailable;
}
async function post<T>(path: string, input: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: "POST", headers: { "content-type": "application/json", "x-superimg-revision": "1" }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok || result.certainty === "unknown" || result.status === "unknown") {
    throw Object.assign(new Error(result.message ?? result.error?.message ?? `Request failed (${response.status})`), {
      unknown: result.certainty === "unknown" || result.status === "unknown", hostReported: true, details: result,
    });
  }
  return result as T;
}
async function run(action: () => Promise<void>, mutation = false, subject: "source" | "export" = "source") {
  busy = true; buttons();
  try { await action(); }
  catch (error) {
    // A lost mutation response cannot establish whether the write started.
    uncertain = remainsUncertain(uncertain, error, mutation);
    if (uncertain && mutation) uncertainSubject = subject;
    candidate = undefined;
    say(uncertain ? "Outcome unknown. Controls are paused; reconcile the source before another mutation. No retry was sent."
      : `${error instanceof Error ? error.message : error}. Previous pixels may be stale.`, uncertain ? "unknown" : "failed");
  } finally { busy = false; buttons(); }
}
function selectPart() {
  candidate = undefined;
  const selected = inspection?.parts.find((item) => item.id === part.value);
  element("explanation").textContent = selected?.reason ?? (selected?.editable ? "Literal source coordinates support an exact edit." : "This part is inspect-only.");
  x.value = String(selected?.value?.x ?? 0);
  y.value = String(selected?.value?.y ?? 0);
  x.disabled = y.disabled = !selected?.editable;
  buttons();
}
async function inspect() {
  inspection = await post<Inspection>("inspect", { editionId: edition.value || undefined });
  element<HTMLIFrameElement>("current").srcdoc = inspection.html;
  element<HTMLIFrameElement>("current").classList.toggle("square", edition.value === "square");
  element("revision").textContent = `Source revision ${inspection.revision}`;
  part.replaceChildren(...inspection.parts.map((item) => new Option(item.label, item.id)));
  selectPart(); report("checks", inspection.checks);
  say("Current source inspected. Select a supported part to preview an edit.");
}
part.addEventListener("change", selectPart);
for (const field of [x, y]) field.addEventListener("input", () => { candidate = undefined; buttons(); });
edition.addEventListener("change", () => { candidate = undefined; element("comparison").hidden = true; void run(inspect); });
element<HTMLFormElement>("edit").addEventListener("submit", (event) => {
  event.preventDefault();
  void run(async () => {
    say("Preparing a non-mutating comparison…");
    candidate = await post<Revision>("preview", { editionId: edition.value || undefined,
      command: { kind: "set-node-transform", partId: part.value, value: { x: Number(x.value), y: Number(y.value) }, sourceRevision: inspection?.revision } });
    element<HTMLIFrameElement>("before").srcdoc = candidate.beforeHtml;
    element<HTMLIFrameElement>("after").srcdoc = candidate.afterHtml;
    element("comparison").hidden = false;
    report("changes", candidate.changes); report("checks", candidate.checks);
    say("Proposed change prepared. Source has not been written.");
  });
});
apply.addEventListener("click", () => void run(async () => {
  if (!candidate) return;
  say("Applying the exact command with fresh source preconditions…");
  const receipt = await post<unknown>("apply", { command: candidate.command });
  candidate = undefined;
  inverseAvailable = true;
  await inspect(); report("changes", receipt);
  say("Host reported the edit result. The preview now reflects a fresh inspection.");
}, true));
undo.addEventListener("click", () => void run(async () => {
  say("Requesting the inverse edit with current source preconditions…");
  const receipt = await post<unknown>("undo", {});
  inverseAvailable = false;
  candidate = undefined;
  await inspect();
  report("changes", receipt);
  say("Host returned the undo result. Current source was inspected again.");
}, true));
reconcile.addEventListener("click", () => void run(async () => {
  if (uncertain && uncertainSubject === "export") {
    say("Local export outcome remains unknown. Inspect the output files; source reconciliation cannot establish the export result. No retry was sent.", "unknown");
    return;
  }
  say("Reconciling the original edit attempt against source…");
  const result = await post<{ status: string }>("reconcile", {});
  report("changes", result);
  uncertain = reconciledUncertainty(uncertain, result.status, uncertainSubject);
  if (result.status === "completed" || result.status === "not-applied") {
    uncertain = false;
    candidate = undefined;
    await inspect();
    say(`Reconciliation reports ${result.status}. No edit was retried.`);
  } else if (result.status === "uncertain") {
    uncertain = true;
    say("The edit outcome remains unknown. Controls stay paused; no retry was sent.", "unknown");
  } else {
    say(uncertain ? "No edit attempt is available to reconcile. The earlier unknown outcome remains unresolved." : "No edit attempt has started.", uncertain ? "unknown" : "ready");
  }
}));
rehearse.addEventListener("click", () => void run(async () => {
  say("Preparing inputs and rehearsing difficult entries…");
  preparedAvailable = false;
  const result = await post<{exportable:boolean}>("batch/rehearse", {});
  report("batch", result);
  preparedAvailable = result.exportable;
  say("Batch rehearsal returned. Inspect its coverage and findings before export.");
}));
element("correct-batch").addEventListener("click", () => void run(async () => {
  preparedAvailable = false;
  const result = await post<{exportable:boolean}>("batch/rehearse", {corrected:true});
  report("batch", result);
  preparedAvailable = result.exportable;
  say("Prepared a new corrected snapshot. Missing pixel readability remains unverified.");
}));
exportButton.addEventListener("click", () => void run(async () => {
  say("Exporting the prepared inputs…");
  preparedAvailable = false;
  report("batch", await post<unknown>("batch/export", {}));
  say("Export returned host-owned unpublished artifacts. See their paths and coverage details.");
}, true, "export"));
void run(inspect);
