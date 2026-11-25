import { Player } from '@foxworth/superimg/player';
import { arrange, type ArrangeRequest } from '@foxworth/superimg/stdlib/arrange';
import { makeMedia, phaseAt, DURATION } from './investigation.media.ts';
import { makeRequest, SIZE, type View } from './requests.ts';
import { schedule } from './model.ts';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <header><a class="wordmark" href="#">superimg<span> / agent lab</span></a><span class="local"><i></i> Browser renderer</span></header>
  <section class="intro"><div><p class="eyebrow">02 / AN EXPLANATION YOU CAN QUESTION</p><h1>The cost of<br>starting too soon.</h1></div><p class="lede">Three agents share a changing revision.<br>Predict the finish. Reveal the dependency.<br>Change one assumption.</p></section>
  <section class="lab" aria-label="Agent investigation">
    <div class="canvas-side">
      <nav aria-label="Investigation view"><button data-view="timeline" aria-pressed="true">01 <span>Timeline</span></button><button data-view="mechanism" aria-pressed="false">02 <span>Mechanism</span></button><button data-view="compare" aria-pressed="false">03 <span>What if?</span></button></nav>
      <div class="paper"><div id="player" aria-label="SuperImg arrangement"></div></div>
      <div class="transport"><button id="play" disabled>Play explanation</button><input id="scrub" type="range" min="0" max="5.9666667" step="0.0333333" value="2.2" aria-label="Explanation time" disabled><output id="clock">2.2 / 6 s</output></div>
      <div class="phase-row" aria-label="Explanation phase"><button data-phase="hold" disabled>Context</button><button data-phase="predict" disabled>Predict</button><button data-phase="reveal" disabled>Reveal</button><span id="frame-proof">Loading SuperImg…</span></div>
    </div>
    <aside>
      <p class="eyebrow">CHANGE ONE ASSUMPTION</p>
      <label class="setting" for="build-minutes">Build duration <output id="build-value">4 min</output></label>
      <input id="build-minutes" type="range" min="1" max="6" step="1" value="4" disabled>
      <div class="scale"><span>1 min</span><span>6 min</span></div>
      <div class="reading"><span id="reading-label">FINAL RESULT</span><strong id="reading-value">?</strong><p id="reading-note">The last lane shows only its start. Predict the end, then reveal it.</p></div>
      <button id="next" class="primary" disabled>Reveal the answer <span>↗</span></button>
      <p class="evidence">Illustrative data, calculated locally.<br>No real agent trace or AI service.</p>
      <details class="assumptions"><summary>Model assumptions</summary><p>Edits finish at 2, 5, and 8 minutes. One build worker and one test worker process every revision in order. Tests take 2 minutes. Only revision 3 is required.</p><p>Batching waits for the final edit. Early feedback, cancellation, failures, and changing edit times are outside this model.</p></details>
    </aside>
  </section>
  <section class="result-row"><div><span id="admission" class="accepted">Request accepted</span><p id="status" role="status" aria-live="polite">Loading the media value…</p></div><div class="exports"><button id="png" disabled>Export this frame · PNG</button><button id="webm" disabled>Export explanation · WebM</button></div></section>
  <details class="request-panel"><summary>Inspect the agent request <span>JSON → check → SuperImg tree → player / export</span></summary><p>These are the exact inputs to SuperImg. Invalid requests leave the current picture in place.</p><label class="sr-only" for="request">Arrangement request JSON</label><textarea id="request" rows="17" spellcheck="false"></textarea><div class="request-actions"><button id="apply">Check & render</button><button id="invalid">Try a broken request</button><button id="restore">Restore scenario</button><button id="json">Download request</button></div><pre id="request-result" aria-live="polite"></pre></details>
  <footer><span>Rendered by <strong>@foxworth/superimg/player</strong>. Exported by <strong>@foxworth/superimg/runtime</strong>.</span><span>No hand-drawn chart or server rendering.</span></footer>
</main>`;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element ${id}`);
  return node as T;
}
const player = new Player({ container: '#player', playbackMode: 'once', hoverBehavior: 'none' });
let view: View = 'timeline';
let buildMinutes = 4;
let request = makeRequest(view, buildMinutes);
let ready = false;
let custom = false;
let exporting = false;
let serial = Promise.resolve();
let frameCount = 0;
let latestHtml = '';

function note(message: string) { el('status').textContent = message; }
function enqueue(task: () => Promise<void>) {
  serial = serial.then(task).catch(error => note(error instanceof Error ? error.message : String(error)));
  return serial;
}
function admission(ok: boolean) {
  el('admission').textContent = ok ? 'Request accepted' : 'Request refused';
  el('admission').className = ok ? 'accepted' : 'refused';
}
function sync() {
  if (!ready) return;
  const phase = phaseAt(player.currentTimeSeconds / DURATION);
  el('clock').textContent = `${player.currentTimeSeconds.toFixed(1)} / 6 s`;
  el<HTMLInputElement>('scrub').value = String(player.currentTimeSeconds);
  el('play').textContent = player.isPlaying ? 'Pause' : 'Play explanation';
  document.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.phase === phase)));
  el('frame-proof').textContent = `SuperImg · frame ${player.currentFrame + 1} / 180`;
  el<HTMLInputElement>('build-minutes').value = String(buildMinutes);
  el('build-value').textContent = `${buildMinutes} min`;
  const s = schedule(buildMinutes);
  el('reading-label').textContent = view === 'mechanism' ? 'THE EVIDENCE' : view === 'compare' ? 'TIME TO FINAL RESULT' : 'FINAL RESULT';
  el('reading-value').textContent = custom ? 'Custom' : view === 'mechanism' ? (phase === 'reveal' ? 'Mixed' : '?') : phase === 'reveal' ? (view === 'compare' ? `${s.finish} → ${s.batchFinish} min` : `${s.finish} min`) : '?';
  el('reading-note').textContent = custom ? 'Your request is shown in the player. Scenario totals are hidden.' : view === 'mechanism' ? (phase === 'reveal' ? 'A computed queue, an interpretation, and a proposal carry different marks. Real causality needs artifact and revision evidence.' : 'One relationship is computed. Which of the other connections can the trace actually establish?') : phase !== 'reveal' ? 'The answer is a start tick, not a full bar. Predict its extent, then reveal it.' : view === 'compare' ? `${s.finish - s.batchFinish} minutes sooner; ${s.workerMinutesSaved} fewer worker-minutes. Fast builds can save compute without changing the finish.` : 'The earlier bars are revisions 1 and 2. Only the last test completes the requested revision.';
  el('next').textContent = phase !== 'reveal' ? 'Reveal the answer ↗' : view === 'timeline' ? 'Trace the mechanism ↗' : view === 'mechanism' ? 'Try a different schedule ↗' : 'Predict again ↗';
}
async function load(raw: unknown, at = 2.2) {
  const parsed = arrange.parseRequest(raw);
  const failures = arrange.checkRequest(parsed);
  if (failures.length) throw new Error(failures.map(f => `${f.code}: ${f.message}`).join('\n'));
  const media = makeMedia(parsed);
  const result = await player.load(media);
  if (result.status !== 'success') throw new Error(result.message);
  request = parsed;
  ready = true;
  player.pause();
  await player.seek({ seconds: at });
  el<HTMLTextAreaElement>('request').value = JSON.stringify(request, null, 2);
  el('request-result').textContent = `PASS · ${request.pattern} · 0 admission failures`;
  admission(true);
  sync();
}
async function choose(nextView: View, at = 2.2, nextBuildMinutes = buildMinutes) {
  await load(makeRequest(nextView, nextBuildMinutes), at);
  view = nextView;
  buildMinutes = nextBuildMinutes;
  custom = false;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  sync();
  note('Checked request rendered locally by SuperImg.');
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => void enqueue(() => choose(button.dataset.view as View)));
document.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(button => button.onclick = () => void enqueue(async () => { player.pause(); await player.seek({ seconds: ({ hold: 0, predict: 2.2, reveal: 4.5 })[button.dataset.phase as 'hold' | 'predict' | 'reveal'] }); sync(); }));
el('play').onclick = () => void enqueue(async () => { if (player.isPlaying) player.pause(); else { if (player.currentTimeSeconds >= DURATION - 0.05) await player.seek({ seconds: 0 }); player.play(); } sync(); });
el<HTMLInputElement>('scrub').oninput = () => { const time = Number(el<HTMLInputElement>('scrub').value); void enqueue(async () => { player.pause(); await player.seek({ seconds: time }); sync(); }); };
el<HTMLInputElement>('build-minutes').oninput = () => { el('build-value').textContent = `${el<HTMLInputElement>('build-minutes').value} min`; };
el<HTMLInputElement>('build-minutes').onchange = () => {
  const next = Number(el<HTMLInputElement>('build-minutes').value);
  void enqueue(async () => { const at = player.currentTimeSeconds; await choose(view, at, next); });
};
el('next').onclick = () => void enqueue(async () => { if (phaseAt(player.currentTimeSeconds / DURATION) !== 'reveal') { player.pause(); await player.seek({ seconds: 4.5 }); sync(); } else await choose(view === 'timeline' ? 'mechanism' : view === 'mechanism' ? 'compare' : 'timeline'); });
async function applyRaw(raw: unknown) {
  try { await load(raw); custom = true; sync(); note('Custom request accepted and rendered.'); }
  catch (error) { admission(false); el('request-result').textContent = error instanceof Error ? error.message : String(error); note('SuperImg refused the request. The last accepted picture is still displayed.'); }
}
el('apply').onclick = () => void enqueue(async () => {
  try { await applyRaw(JSON.parse(el<HTMLTextAreaElement>('request').value)); }
  catch (error) { admission(false); el('request-result').textContent = String(error); }
});
el('invalid').onclick = () => void enqueue(async () => {
  const broken = structuredClone(makeRequest('mechanism', buildMinutes));
  if (broken.pattern === 'mechanism-strip') broken.spec.edges[1].to = 'undeclared-agent';
  el<HTMLTextAreaElement>('request').value = JSON.stringify(broken, null, 2);
  await applyRaw(broken);
});
el('restore').onclick = () => void enqueue(() => choose(view));
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
el('json').onclick = () => save(new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }), `agent-${view}.json`);
async function exportCurrent(format: 'png' | 'webm') {
  if (exporting || !ready) return;
  exporting = true;
  el<HTMLButtonElement>('png').disabled = true;
  el<HTMLButtonElement>('webm').disabled = true;
  player.pause();
  const capturedRequest = structuredClone(request);
  const at = player.currentTimeSeconds;
  const exportName = `agent-${view}`;
  note(`Preparing ${format.toUpperCase()} in this browser…`);
  try {
    const { init, check, exportMedia } = await import('@foxworth/superimg/runtime');
    const runtime = await init();
    try {
      const media = makeMedia(capturedRequest);
      const report = await check(media, { runtime });
      if (!report.ok) throw new Error(`SuperImg check failed: ${JSON.stringify(report)}`);
      const size = capturedRequest.spec.size ?? SIZE;
      const bundle = await exportMedia(media, { runtime,
        for: [{ id: exportName, width: size.width, height: size.height, format }],
        ...(format === 'png' ? { at } : {}),
        onProgress: event => { note(`Rendering ${format.toUpperCase()} in this browser · ${event.state}…`); },
      });
      try {
        for (const artifact of bundle.artifacts) {
          const blob = await new Response(artifact.stream()).blob();
          save(new Blob([blob], { type: artifact.mimeType }), artifact.path.split('/').pop()!);
          note(`Exported ${artifact.mimeType} · ${(blob.size / 1024).toFixed(1)} KB · SHA-256 ${artifact.sha256.slice(0, 12)} · browser runtime`);
        }
      } finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); }
  } catch (error) { note(`Export failed: ${error instanceof Error ? error.message : String(error)}`); }
  finally { exporting = false; el<HTMLButtonElement>('png').disabled = false; el<HTMLButtonElement>('webm').disabled = false; }
}
el('png').onclick = () => void enqueue(() => exportCurrent('png'));
el('webm').onclick = () => void enqueue(() => exportCurrent('webm'));
player.on('rendered', payload => { frameCount++; latestHtml = payload.html; });
player.on('frame', sync);
player.on('play', sync);
player.on('pause', sync);
player.on('ended', sync);
player.on('error', error => note(error.message));

// Read-only local inspection seam for the demo's browser verification.
Object.defineProperty(window, '__agentDemo', { configurable: true, get: () => ({
  engine: '@foxworth/superimg/player', ready, view, buildMinutes, request, frameCount, latestHtml,
  frame: ready ? player.currentFrame : null, duration: DURATION,
}) });
void load(request).then(() => {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[disabled], input[disabled]').forEach(node => node.disabled = false);
  note('Checked JSON → SuperImg arrangement → browser player. Ready.');
}).catch(error => note(`Could not load SuperImg: ${error.message}`));
if (import.meta.hot) import.meta.hot.dispose(() => player.dispose());
