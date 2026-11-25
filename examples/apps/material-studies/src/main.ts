import { Player } from '@foxworth/superimg/player';
import { createInteractivePlayer } from '@foxworth/superimg/interactive/player';
import { type InteractiveDefinition } from '@foxworth/superimg/interactive/define';
import { createPreviewInspection, type PreviewSnapshot } from '@foxworth/superimg/inspection';
import { MATERIAL_FONT_CSS, MATERIAL_FONT_HASHES } from '../../../showcase/_material/resources.ts';
import { canvasPoint, fingerprint, HostClock, LatestPump, SelectionEpoch, StrokeRecorder, type BrushStroke } from './host.ts';
import { runBenchmark, type Acceptance, type BenchmarkPort } from './benchmark.ts';
import { findStudy, isAvailable, refreshAvailability, STUDIES, type Fidelity, type Study, type StudyData, type StudyId } from './studies.ts';
import { currentSourceDigests } from 'virtual:material-study-source-digests';
import { fetchQualification, choosePreview, type QualificationDocument, type PreviewChoice } from './qualification.ts';
import { acceptedObservation } from './accepted-observation.ts';
import './style.css';

document.head.appendChild(Object.assign(document.createElement('style'), { textContent: MATERIAL_FONT_CSS }));
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <header><a class="wordmark" href="https://superimg.app">SuperImg <span> / material studies</span></a><span class="edition">FIVE ORIGINAL EXPERIMENTS · 4K / 30</span></header>
    <section class="intro"><p class="eyebrow">GRAINS WITH SOMETHING TO SAY</p><div class="intro-line"><h1>Form. Meaning.<br>Then matter again.</h1><p>Five ways to make a material think.<br>Explore the scenes that make the films.</p></div></section>
    <nav class="studies" aria-label="Choose a material study">${STUDIES.map((study) => `<button class="study" data-study="${study.id}" aria-pressed="false" style="--accent:${study.color}"><span class="study-top"><span>${study.number}</span><span class="availability">${isAvailable(study.id) ? 'EXPLORE' : 'BUILDING'}</span></span><svg viewBox="0 0 156 76" aria-hidden="true">${study.thumbnail}</svg><strong>${study.title}</strong><span>${study.subtitle}</span></button>`).join('')}</nav>
    <section class="workspace" aria-labelledby="study-title">
      <div class="visual"><div class="stage"><div id="player" aria-label="Material study rendering"></div><div id="brush" class="brush" tabindex="0" role="application" aria-label="Brush canvas. Arrow keys move the brush; Space disturbs the painting." hidden><span id="brush-cursor" aria-hidden="true"></span></div><div id="loading" role="status">Preparing the material…</div></div>
        <div class="transport"><button id="play" disabled>Play</button><button id="reset" disabled>Reset</button><label class="scrubber" for="time"><span class="sr-only">Study time</span><input id="time" type="range" min="0" max="40" step="0.033333" value="0" disabled></label><output id="clock">0.0 s</output></div>
        <div class="visual-note"><span id="fidelity-note">1280 × 720 live preview · silent</span><span id="count-note"></span></div><div class="rough-actions"><button id="watch-film" disabled>Watch portfolio film</button><button id="watch-rough" disabled>Watch motion rough</button><button id="view-poster" disabled>Open rough still</button><button id="refresh-artifacts">Refresh films & roughs</button><span id="rough-note">Rendered roughs appear here as they are made.</span></div>
      </div>
      <aside><p class="eyebrow" id="study-number"></p><h2 id="study-title"></h2><p id="description"></p>
        <label class="setting" for="fidelity">Preview fidelity <select id="fidelity"><option value="full">Full</option><option value="reduced">Reduced</option></select></label><p class="hint" id="profile-status">Full · performance has not been measured.</p>
        <div id="controls"></div><p class="hint" id="motion-note"></p><p id="status" role="status" aria-live="polite">Loading the first study…</p>
      </aside>
    </section>
    <section class="notes"><div><p class="eyebrow">THE FILM AND ITS MODEL</p><p id="mechanism"></p></div><div><p class="eyebrow">INSPECTABLE BY DESIGN</p><p>Native controls change a recorded input. A capture freezes that input and the host clock before waiting for an accepted frame and its resources.</p></div></section>
    <details class="measurement"><summary>Measured performance and capture record</summary><p class="hint">A full benchmark takes about 10½ minutes per fidelity. Run Full and Reduced separately. Results describe this browser and machine.</p><div class="measurement-actions"><button id="benchmark">Benchmark this fidelity</button><button id="stop-benchmark" hidden>Stop benchmark</button><button id="download">Download session JSON</button><button id="capture">Freeze current frame</button><button id="release">Return to live</button></div><pre id="record">No benchmark or capture has been recorded.</pre></details>
    <footer><span>Original material studies, authored with SuperImg.</span><span>Deterministic models · live controls · cinematic films</span></footer>
    <dialog id="rough-viewer"><div class="rough-heading"><h2 id="rough-title"></h2><button id="close-rough">Close</button></div><p id="rough-description"></p><label id="clip-select-label" for="clip-select">Review excerpt <select id="clip-select"></select></label><video id="rough-video" controls loop muted playsinline hidden></video><img id="rough-poster" alt="Rendered material study rough" hidden><details><summary>Captured source and artifact identity</summary><pre id="rough-identity"></pre></details></dialog>
  </main>`;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const inspection = createPreviewInspection({ readinessTimeoutMs: 15_000 });
const epoch = new SelectionEpoch();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sessions: Array<Record<string, unknown>> = [];
const benchmarkResults: Array<Record<string, unknown>> = [];
const surfaceId = 'material-study';
let current: Session | undefined;
let benchmarkController: AbortController | undefined;
let disposed = false;
interface RoughClip { id: string; label: string; url: string; sha256: string; fps?: number; durationSeconds?: number; range?: string[]; dimensions?: { width: number; height: number }; silent?: boolean; source: unknown }
interface RoughPoster { id?: string; label?: string; url: string; source: unknown; sha256: string }
interface RoughStudy { poster?: RoughPoster; posters?: RoughPoster[]; clips: RoughClip[]; films?: RoughClip[] }
let roughs: Partial<Record<StudyId, RoughStudy>> = {};

interface InputRequest { data: StudyData; seconds: number; version: number; requestedAt: number; source: Acceptance['source'] }
interface BoundInput { data: StudyData; seconds: number; generation: number; revision: number; frame: number; inputVersion: number; recordId: string }
interface CaptureRecord { study: StudyId; input: BoundInput; snapshot: PreviewSnapshot; fontHashes: typeof MATERIAL_FONT_HASHES }
interface Session {
  study: Study;
  sourceDigest: string;
  qualification: QualificationDocument | null;
  previewChoice: PreviewChoice;
  player: Pick<Player, 'getPresentation' | 'getState' | 'getPerformance' | 'getDriveKind' | 'pause' | 'seek' | 'update' | 'suspendDrive' | 'on' | 'dispose' | 'isReady' | 'currentFrame' | 'fps' | 'totalFrames' | 'hostElement'>;
  interactive?: ReturnType<typeof createInteractivePlayer<Record<string, unknown>>>;
  clock: HostClock;
  data: StudyData;
  initial: StudyData;
  pump: LatestPump<InputRequest>;
  accepted?: BoundInput;
  acceptances: Acceptance[];
  version: number;
  suspended: number;
  capture?: CaptureRecord;
  detach?: { dispose(): void };
  removeListeners: Array<() => void>;
  raf: number;
  disposed: boolean;
  driveRelease?: () => void;
  strokes: StrokeRecorder;
  observe: (data: StudyData, seconds: number, frame: number) => Record<string, unknown>;
  observation?: Record<string, unknown>;
  routeStart?: { seconds: number; progress: number };
  tick?: FrameRequestCallback;
}

function note(message: string) { el('status').textContent = message; }
function fail(error: unknown) { note(error instanceof Error ? error.message : String(error)); }
function clone<T>(value: T): T { return structuredClone(value); }
function controlsEnabled(ready: boolean) {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('.transport button, .transport input, aside input, aside select, aside button, .measurement-actions button').forEach((control) => { control.disabled = !ready; });
}
function syncRoughs(id?: StudyId) {
  const item = id ? roughs[id] : undefined;
  el<HTMLButtonElement>('watch-rough').disabled = !item?.clips.length;
  el<HTMLButtonElement>('watch-film').disabled = !item?.films?.length;
  el<HTMLButtonElement>('view-poster').disabled = !item?.poster;
  el('rough-note').textContent = item ? `${item.films?.length ?? 0} films · ${item.posters?.length ?? 0} rough stills · ${item.clips.length} motion excerpts` : 'Rendered roughs appear here as they are made.';
}
async function refreshRoughs() {
  const response = await fetch('/portfolio/manifest.json', { cache: 'no-store' });
  if (!response.ok) return;
  const value = await response.json() as { studies?: typeof roughs };
  roughs = value.studies ?? {};
  for (const study of STUDIES) {
    const poster = roughs[study.id]?.poster;
    const button = document.querySelector<HTMLButtonElement>(`[data-study="${study.id}"]`);
    const prior = button?.querySelector<HTMLImageElement>('.tile-poster');
    if (!poster || !button) continue;
    if (prior) { prior.src = poster.url; continue; }
    const img = document.createElement('img'); img.className = 'tile-poster'; img.src = poster.url; img.alt = ''; img.loading = 'lazy';
    button.querySelector('svg')?.replaceWith(img);
  }
  syncRoughs(current?.study.id);
}
function showRough(kind: 'clip' | 'poster' | 'film') {
  if (!current) return;
  pause(current);
  const item = roughs[current.study.id]; if (!item) return;
  const dialog = el<HTMLDialogElement>('rough-viewer');
  el('rough-title').textContent = current.study.title;
  const video = el<HTMLVideoElement>('rough-video'); const image = el<HTMLImageElement>('rough-poster');
  video.pause(); video.hidden = kind === 'poster'; image.hidden = kind !== 'poster';
  video.loop = kind === 'clip'; video.muted = true;
  el('clip-select-label').hidden = false;
  el('clip-select-label').firstChild!.textContent = kind === 'poster' ? 'Rough still ' : kind === 'film' ? 'Film edition ' : 'Review excerpt ';
  if (kind === 'poster' && item.poster) {
    const posters = item.posters?.length ? item.posters : [item.poster];
    const select = el<HTMLSelectElement>('clip-select'); select.replaceChildren();
    for (const [i, poster] of posters.entries()) select.appendChild(new Option(poster.label ?? 'Rendered rough', String(i)));
    select.value = String(posters.length - 1);
    const choose = () => {
      const poster = posters[Number(select.value)]!;
      image.src = poster.url;
      el('rough-description').textContent = 'Rendered still · 1280 × 720 preview derived from the captured source. Earlier revisions are retained.';
      el('rough-identity').textContent = JSON.stringify(poster, null, 2);
    };
    select.onchange = choose; choose();
  } else if ((kind === 'clip' && item.clips.length) || (kind === 'film' && item.films?.length)) {
    const clips = kind === 'film' ? item.films! : item.clips;
    const select = el<HTMLSelectElement>('clip-select'); select.replaceChildren();
    for (const clip of clips) select.appendChild(new Option(clip.label, clip.id));
    const choose = () => {
      const clip = clips.find(value => value.id === select.value)!;
      video.src = clip.url;
      el('rough-description').textContent = `${clip.durationSeconds ?? '—'} seconds · ${clip.fps ?? '—'} fps · ${kind === 'film' ? `${clip.dimensions?.width} × ${clip.dimensions?.height} film · use the sound control to hear its score` : 'silent review excerpt'}${clip.range ? ` · authored ${clip.range.join('–')}` : ''}`;
      el('rough-identity').textContent = JSON.stringify(clip, null, 2);
      void video.play().catch(() => {});
    };
    select.onchange = choose; choose();
  }
  dialog.showModal();
}
function sceneSeconds(session: Session, frame: number) {
  return frame / Math.max(1, session.player.totalFrames - 1) * session.study.seconds;
}
function frameAt(session: Session, seconds: number) {
  return Math.max(0, Math.min(session.player.totalFrames - 1, Math.round(seconds / session.study.seconds * (session.player.totalFrames - 1))));
}
function active(session: Session) { return !session.disposed && current === session; }

function bindAccepted(session: Session, request: InputRequest): void {
  const shown = session.player.getPresentation();
  if (!active(session) || shown.isPending || !shown.accepted) return;
  const acceptedAt = performance.now();
  const record = clone(request.data);
  const seconds = session.study.kind === 'interactive' ? request.seconds : sceneSeconds(session, shown.accepted.frame);
  session.accepted = { data: record, seconds, generation: shown.generation, revision: shown.accepted.revision, frame: shown.accepted.frame, inputVersion: request.version, recordId: fingerprint({ study: session.study.id, data: record, seconds }) };
  session.observation = session.interactive
    ? acceptedObservation(session.study.id, shown.accepted.semantic?.root, request.version)
    : session.observe(record, seconds, shown.accepted.frame);
  session.acceptances.push({ inputVersion: request.version, requestedAt: request.requestedAt, acceptedAt, generation: shown.generation, revision: shown.accepted.revision, frame: shown.accepted.frame, source: request.source });
  if (session.acceptances.length > 25_000) session.acceptances.splice(0, session.acceptances.length - 25_000);
  sync(session);
}

function submit(session: Session, patch: Record<string, unknown>, seconds = session.clock.seconds, source: Acceptance['source'] = 'control', frozen = false) {
  const requestedAt = performance.now();
  if (!active(session) || (session.suspended && !frozen)) return Promise.resolve('disposed' as const);
  if ((patch.fidelity === 'full' || patch.fidelity === 'reduced') && patch.fidelity !== session.data.fidelity) {
    session.previewChoice = choosePreview(session.study.id, session.sourceDigest, session.qualification, patch.fidelity);
  }
  session.version++;
  if (session.study.id === 'returning-shore') {
    const strokes = (patch.strokes ?? session.data.strokes ?? []) as readonly BrushStroke[];
    let last = -Infinity;
    for (const stroke of strokes) for (const point of stroke.points) last = Math.max(last, point.at);
    session.clock.extendThrough(Math.max(seconds, last + 4));
  }
  session.clock.seek(seconds);
  seconds = session.clock.seconds;
  session.data = { ...session.data, ...patch, inputVersion: session.version,
    logicalSeconds: session.study.kind === 'interactive' ? seconds : (patch.logicalSeconds ?? null) } as StudyData;
  return session.pump.submit({ data: clone(session.data), seconds, version: session.version, requestedAt, source });
}

function holdInput(session: Session): () => void {
  session.suspended++;
  cancelAnimationFrame(session.raf); session.raf = 0;
  const releaseClock = session.clock.suspend();
  const releaseDrive = session.player.suspendDrive();
  let released = false;
  return () => { if (!released) { released = true; session.suspended--; releaseClock(); releaseDrive(); if (active(session) && session.clock.playing && !session.suspended && session.tick) session.raf = requestAnimationFrame(session.tick); } };
}

function disposeSession(session: Session) {
  if (session.disposed) return;
  session.disposed = true;
  session.clock.pause(); cancelAnimationFrame(session.raf);
  session.pump.dispose();
  session.detach?.dispose();
  session.driveRelease?.();
  for (const remove of session.removeListeners.splice(0)) remove();
  if (session.interactive) session.interactive.dispose(); else session.player.dispose();
}

async function select(id: StudyId): Promise<void> {
  const ticket = epoch.begin();
  benchmarkController?.abort();
  if (current) { disposeSession(current); current = undefined; }
  controlsEnabled(false);
  el('brush').hidden = true;
  const study = findStudy(id);
  location.hash = id;
  document.querySelectorAll<HTMLButtonElement>('[data-study]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.study === id)));
  el('study-title').textContent = study.title;
  el('study-number').textContent = `${study.number} / ${study.subtitle}`;
  el('description').textContent = study.description;
  el('loading').hidden = false;
  el('loading').textContent = isAvailable(id) ? 'Preparing the material…' : 'This study is being built. Explore another material while it takes shape.';
  el('controls').innerHTML = '';
  syncRoughs(id);
  el('count-note').textContent = '';
  el('clock').textContent = '—';
  el('mechanism').textContent = study.description;
  el('profile-status').textContent = 'Measurements pending.';
  note(isAvailable(id) ? 'Loading the selected study…' : 'This study is being built. Choose an available material to explore.');
  try {
    const [module, qualification, digests] = await Promise.all([study.load(), fetchQualification(), currentSourceDigests()]);
    document.querySelectorAll<HTMLButtonElement>('[data-study]').forEach((button) => { const label = button.querySelector('.availability'); if (label) label.textContent = isAvailable(button.dataset.study as StudyId) ? 'EXPLORE' : 'BUILDING'; });
    if (!epoch.current(ticket) || disposed) return;
    const container = el('player');
    const interactive = study.kind === 'interactive' ? createInteractivePlayer<Record<string, unknown>>({ container, size: { width: 1280, height: 720 }, playbackMode: 'once' }) : undefined;
    const player = interactive?.player ?? new Player({ container, size: { width: 1280, height: 720 }, hoverBehavior: 'none', playbackMode: 'once', ...(study.kind === 'pointer' ? { drive: 'pointer' as const } : {}) });
    const saved = localStorage.getItem(`material-explicit-profile:${study.id}`);
    const explicit = saved === 'full' || saved === 'reduced' ? saved : undefined;
    const previewChoice = choosePreview(id, digests[id], qualification, explicit);
    const fidelity = previewChoice.fidelity;
    const data = { ...module.initial, fidelity, reducedMotion: reducedMotion.matches, ...(id === 'sandglass' ? { compare: false } : {}), logicalSeconds: study.kind === 'interactive' ? (id === 'returning-shore' ? 6 : id === 'aster-basin' ? 13 : id === 'sandglass' ? 0 : study.settled) : null } as StudyData;
    const session: Session = {
      study, sourceDigest: digests[id], qualification, previewChoice, player, interactive, clock: new HostClock(study.seconds), data, initial: clone(data), version: 0,
      suspended: 0, acceptances: [], removeListeners: [], raf: 0, disposed: false, strokes: new StrokeRecorder(),
      pump: undefined as unknown as LatestPump<InputRequest>, observe: module.observe,
    };
    current = session;
    session.clock.seek(Number(data.logicalSeconds ?? study.settled));
    session.pump = new LatestPump(async (request) => {
      if (!active(session)) return;
      if (interactive) await interactive.setData(request.data);
      else {
        await player.update({ data: request.data });
        if (active(session)) await player.seek({ frame: frameAt(session, request.seconds) });
      }
      bindAccepted(session, request);
    }, fail);
    const options = { data, fonts: { css: MATERIAL_FONT_CSS }, performance: { capacity: 512 } };
    const result = interactive ? await interactive.load(module.live as InteractiveDefinition<Record<string, unknown>>, options) : await player.load(module.live as Parameters<Player['load']>[0], options);
    if (!epoch.current(ticket) || disposed) { disposeSession(session); return; }
    if (result.status !== 'success') throw new Error(result.message);
    if (study.kind !== 'interactive') {
      session.driveRelease = player.suspendDrive();
      await player.seek({ frame: frameAt(session, study.settled) });
      if (!reducedMotion.matches) { session.driveRelease(); session.driveRelease = undefined; }
    }
    bindAccepted(session, { data, seconds: session.clock.seconds, version: 0, requestedAt: performance.now(), source: 'control' });
    session.removeListeners.push(player.on('presentation', (shown) => {
      if (!active(session) || shown.isPending || !shown.accepted || session.study.kind !== 'pointer' || session.suspended || session.pump.busy) return;
      if (session.accepted?.revision === shown.accepted.revision) return;
      session.clock.seek(sceneSeconds(session, shown.accepted.frame));
      bindAccepted(session, { data: session.data, seconds: session.clock.seconds, version: session.version, requestedAt: performance.now(), source: 'pointer' });
    }));
    session.detach = inspection.attach({ surfaceId, player, ...(interactive ? { interactive } : {}), source: { id: `material-studies/${id}` }, controls: ['set-mode', 'seek-frame'], suspendInput: () => holdInput(session), sidecar: ({ frame, revision, generation }) => {
      const accepted = session.accepted;
      if (!accepted || accepted.frame !== frame || accepted.revision !== revision || accepted.generation !== generation) return {};
      return { semantic: { study: id, inputVersion: accepted.inputVersion, inputRecord: accepted.recordId, logicalSeconds: accepted.seconds, fidelity: accepted.data.fidelity, canvas: { width: 1280, height: 720 }, fontHashes: MATERIAL_FONT_HASHES, observation: session.observation, data: accepted.data } };
    } });
    setupControls(session);
    el('loading').hidden = true;
    controlsEnabled(true);
    syncRoughs(id);
    el<HTMLInputElement>('time').max = String(study.seconds);
    sync(session);
    note('Ready. Explore the material with the controls.');
    const tick = (now: number) => {
      if (!active(session)) return;
      session.raf = 0;
      const seconds = session.clock.tick(now);
      if (seconds !== null) {
        const patch = id === 'aster-basin' && session.data.live === true && session.data.focus === 'route' && session.routeStart
          ? { routeProgress: Math.min(1, session.routeStart.progress + (seconds - session.routeStart.seconds) / 9) } : {};
        void submit(session, patch, seconds, 'clock');
        if (id === 'aster-basin' && Number(session.data.routeProgress) >= 1 && session.data.live === true) session.clock.pause();
        if (id === 'sandglass') {
          const primary = session.observation?.primary as { finishSeconds?: number } | undefined;
          const comparison = session.observation?.comparison as { finishSeconds?: number } | undefined;
          const finish = Math.max(primary?.finishSeconds ?? 98, comparison?.finishSeconds ?? 0);
          if (seconds >= finish) session.clock.pause();
        }
      }
      if (id === 'returning-shore' && session.clock.playing && session.strokes.strokes.length) {
        const last = session.strokes.strokes.at(-1)?.points.at(-1)?.at ?? 0;
        if (session.clock.seconds >= last + 4) session.clock.pause();
      }
      if (session.clock.playing && !session.suspended) session.raf = requestAnimationFrame(tick);
    };
    session.tick = tick;
    sessions.push({ study: id, loadedAt: new Date().toISOString(), initial: clone(data), fonts: MATERIAL_FONT_HASHES, sourceDigest: session.sourceDigest, previewChoice });
    location.hash = id;
  } catch (error) {
    if (!epoch.current(ticket)) return;
    if (current) { disposeSession(current); current = undefined; }
    el('loading').textContent = error instanceof Error ? error.message : String(error);
    controlsEnabled(false);
    fail(error);
  }
}

function sync(session: Session) {
  if (!active(session)) return;
  const seconds = session.accepted?.seconds ?? session.clock.seconds;
  el<HTMLInputElement>('time').max = String(session.clock.duration);
  el<HTMLInputElement>('time').value = String(seconds);
  el('clock').textContent = `${seconds.toFixed(1)} s`;
  el('play').textContent = session.study.kind === 'pointer' ? 'Pointer' : session.clock.playing ? 'Pause' : 'Play';
  el<HTMLButtonElement>('play').disabled = session.study.kind === 'pointer' || reducedMotion.matches || session.suspended > 0;
  el<HTMLSelectElement>('fidelity').value = session.data.fidelity;
  el('profile-status').textContent = session.previewChoice.message;
  el('fidelity-note').textContent = `1280 × 720 · ${session.data.fidelity === 'full' ? 'Full' : 'Reduced'} preview · silent`;
  const counts = grainCounts(session);
  el('count-note').textContent = `${counts.logical.toLocaleString()} logical grains${counts.drawn === null ? '' : ` · ${counts.drawn.toLocaleString()} drawing pool`}${counts.projected === undefined ? '' : ` · ${counts.projected.toLocaleString()} projected in view`}`;
  const worker = document.querySelector<HTMLOutputElement>('#worker-value'); if (worker) worker.value = String(session.data.workers);
  const arrival = document.querySelector<HTMLOutputElement>('#arrival-value'); if (arrival) arrival.value = `${session.data.arrivalRate} / s`;
  for (const [id, key] of [['worker', 'workers'], ['arrival', 'arrivalRate'], ['compare-worker', 'compareWorkers'], ['request', 'selectedRequest']] as const) {
    const input = document.querySelector<HTMLInputElement>(`#${id}`); if (input && document.activeElement !== input) input.value = String(session.data[key]);
  }
  const compare = document.querySelector<HTMLInputElement>('#compare'); if (compare && document.activeElement !== compare) compare.checked = session.data.compare === true;
  const follow = document.querySelector<HTMLInputElement>('#follow'); if (follow && document.activeElement !== follow) follow.checked = session.data.followGrains === true;
  const details = document.querySelector<HTMLElement>('#request-detail');
  if (details) {
    const selected = session.observation?.selected as { id: number; state: string; arrival: number; start: number; end: number; visibleWait: number } | undefined;
    details.textContent = selected ? `Request ${selected.id} · ${selected.state}. Arrives ${selected.arrival.toFixed(1)} s; service ${selected.start.toFixed(1)}–${selected.end.toFixed(1)} s. Visible wait ${selected.visibleWait.toFixed(1)} s.` : `Request ${session.data.selectedRequest ?? 17}.`;
  }
}

function grainCounts(session: Session): { logical: number; drawn: number | null; projected?: number } {
  const props = session.observation;
  const grains = props?.grains as { total?: number; drawn?: number } | undefined;
  const logical = props?.logicalPopulation ?? props?.logicalGrains ?? props?.logicalCount ?? grains?.total ?? session.study.logicalCount;
  const drawn = props?.drawnPopulation ?? props?.drawnGrains ?? props?.drawnCount ?? grains?.drawn;
  // Never pretend a decorative 50% rule specifies actual protected-grain counts.
  const projectedRoles = ['projectedArchitecture', 'projectedRoute', 'projectedBed'].map(key => (grains as Record<string, unknown> | undefined)?.[key]);
  const projected = projectedRoles.every(value => typeof value === 'number') ? (projectedRoles as number[]).reduce((sum, value) => sum + value, 0) : undefined;
  return { logical: typeof logical === 'number' ? logical : session.study.logicalCount, drawn: typeof drawn === 'number' ? drawn : session.data.fidelity === 'full' ? session.study.logicalCount : null, ...(projected === undefined ? {} : { projected }) };
}

const range = (id: string, label: string, min: number, max: number, step: number, value: number) => `<label class="setting" for="${id}">${label}<output id="${id}-value">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
function setupControls(session: Session) {
  const { id } = session.study;
  const controls = el('controls');
  if (id === 'sandglass') {
    controls.innerHTML = `${range('worker', 'Workers', 1, 6, 1, Number(session.data.workers ?? 2))}${range('arrival', 'Arrivals', .5, 6, .5, Number(session.data.arrivalRate ?? 2))}<label class="check"><input id="compare" type="checkbox"> Compare a second vessel</label>${range('compare-worker', 'Comparison workers', 1, 6, 1, Number(session.data.compareWorkers ?? 4))}${range('request', 'Follow request', 1, 48, 1, Number(session.data.selectedRequest ?? 17))}<p id="request-detail" class="hint"></p>`;
    el<HTMLInputElement>('compare').checked = session.data.compare === true;
    for (const [field, key] of [['worker', 'workers'], ['arrival', 'arrivalRate'], ['compare-worker', 'compareWorkers']] as const) el<HTMLInputElement>(field).oninput = () => {
      pause(session); void submit(session, { [key]: Number(el<HTMLInputElement>(field).value) }, 0);
      el<HTMLOutputElement>(`${field}-value`).value = el<HTMLInputElement>(field).value;
    };
    el<HTMLInputElement>('compare').onchange = () => { const compare = el<HTMLInputElement>('compare').checked; pause(session); void submit(session, { compare }, 0); };
    el<HTMLInputElement>('request').oninput = () => { void submit(session, { selectedRequest: Number(el<HTMLInputElement>('request').value) }); el<HTMLOutputElement>('request-value').value = el<HTMLInputElement>('request').value; };
    el('mechanism').textContent = 'One rigid twelve-grain cluster is one request. Requests wait, occupy a discrete worker channel, then settle. The pile is authored geometry; the scheduling is deterministic FIFO.';
  } else if (id === 'cleft') {
    controls.innerHTML = '<p class="hint">Move across the image to reveal the material. Presets hold their selected frame until you resume pointer control.</p><div class="presets"><button data-cleft="1.6">Reveal</button><button data-cleft="3.4">Ink</button><button data-cleft="4.8">Mineral</button><button data-cleft="6.5">Graphite</button></div><button id="resume-pointer">Resume pointer</button>';
    controls.querySelectorAll<HTMLButtonElement>('[data-cleft]').forEach((button) => { button.onclick = () => { pause(session); void seek(session, Number(button.dataset.cleft)); }; });
    el('resume-pointer').onclick = () => { if (reducedMotion.matches || session.suspended) return; session.driveRelease?.(); session.driveRelease = undefined; note('Pointer control resumed.'); };
    el('mechanism').textContent = 'Three paints share two fixed contours. The stepped gap belongs to the geometry, so changing the material never changes the identity.';
  } else if (id === 'borrowed-shapes') {
    controls.innerHTML = '<div class="presets"><button data-form="4.5">Seed</button><button data-form="12.5">Tree</button><button data-form="20.5">Citadel</button></div><div class="presets"><button id="previous-frame">← Frame</button><button id="next-frame">Frame →</button></div><label class="check"><input id="follow" type="checkbox"> Follow twelve grain identities</label>';
    controls.querySelectorAll<HTMLButtonElement>('[data-form]').forEach((button) => { button.onclick = () => { pause(session); void seek(session, Number(button.dataset.form)); }; });
    el('previous-frame').onclick = () => { pause(session); void seek(session, session.clock.seconds - session.study.seconds / (session.player.totalFrames - 1)); };
    el('next-frame').onclick = () => { pause(session); void seek(session, session.clock.seconds + session.study.seconds / (session.player.totalFrames - 1)); };
    el<HTMLInputElement>('follow').onchange = () => { void submit(session, { followGrains: el<HTMLInputElement>('follow').checked }); };
    el('mechanism').textContent = 'Six semantic parts conserve their grain populations. Seed lobes become tree limbs and towers; the core becomes the trunk and courtyard gate. Matching happens within each part.';
  } else if (id === 'returning-shore') {
    controls.innerHTML = '<label class="setting" for="brush-size">Brush size<select id="brush-size"><option value="0.035">Small</option><option value="0.05">Broad</option></select></label><div class="presets"><button id="shore-trace">Trace shoreline</button><button id="shore-restore">Restore now</button><button id="shore-replay">Replay gestures</button></div><p class="hint">Drag over the painting. Keyboard: focus the canvas, use arrows, then Space. Position controls offer the same gesture.</p>'+range('brush-x', 'Brush X', 0, 1, .01, .5)+range('brush-y', 'Brush Y', 0, 1, .01, .5)+'<button id="brush-disturb">Disturb here</button>';
    el('brush').hidden = false;
    installBrush(session);
    el('shore-trace').onclick = () => traceShore(session);
    el('shore-restore').onclick = () => { pause(session); const last = session.strokes.strokes.at(-1)?.points.at(-1)?.at ?? session.clock.seconds; void submit(session, {}, last + 4); };
    el('shore-replay').onclick = () => { if (!session.strokes.strokes.length) return; session.clock.seek(session.strokes.strokes[0]!.points[0]!.at); void submit(session, { strokes: session.strokes.strokes }); playClock(session); };
    el('brush-disturb').onclick = () => disturb(session, Number(el<HTMLInputElement>('brush-x').value), Number(el<HTMLInputElement>('brush-y').value));
    el('mechanism').textContent = 'Brush impulses displace only nearby home positions. A four-second analytic recovery returns the same grains to the same painting. Gesture records remain immutable for replay.';
  } else {
    controls.innerHTML = '<label class="setting" for="era">Era<select id="era"><option value="0">First Quay</option><option value="1">Port City</option><option value="2" selected>Present Terraces</option></select></label><label class="setting" for="future">Imagined future<select id="future"><option value="present">Present</option><option value="raised">Raised Shore</option><option value="open">Open Shore</option></select></label><div class="presets"><button id="atlas-follow">Follow route</button><button id="atlas-overview">Overview</button><button id="atlas-unmake">Unmake</button><button id="atlas-film">Watch choreography</button></div>'+range('route', 'Route progress', 0, 1, .005, 0)+'<label class="setting" for="landmark">Focus landmark<select id="landmark"><option value="overview">Overview</option><option value="causeway">South causeway</option><option value="cistern">Cistern court</option><option value="archive">Tidal archive</option></select></label>';
    el<HTMLSelectElement>('era').onchange = () => { pause(session); el<HTMLSelectElement>('future').value = 'present'; void submit(session, { era: Number(el<HTMLSelectElement>('era').value), future: 'present', routeProgress: 0, focus: 'overview', live: true }); };
    el<HTMLSelectElement>('future').onchange = () => { pause(session); void submit(session, { future: el<HTMLSelectElement>('future').value, focus: 'overview', live: true }); };
    el('atlas-follow').onclick = () => { session.routeStart = { seconds: session.clock.seconds, progress: Number(session.data.routeProgress ?? 0) }; void submit(session, { era: 2, future: 'present', focus: 'route', live: true }); playClock(session); };
    el('atlas-overview').onclick = () => { pause(session); void submit(session, { focus: 'overview', live: true }); };
    el('atlas-unmake').onclick = () => { pause(session); const unmake = Number(session.data.unmake) > 0 ? 0 : 1; void submit(session, { unmake, focus: 'overview', future: 'present', live: true }); el('atlas-unmake').textContent = unmake ? 'Restore' : 'Unmake'; };
    el('atlas-film').onclick = () => { session.routeStart = undefined; session.clock.seek(0); void submit(session, { live: false }, 0); playClock(session); };
    el<HTMLInputElement>('route').oninput = () => { pause(session); const value = Number(el<HTMLInputElement>('route').value); void submit(session, { routeProgress: value, focus: 'route', live: true }); el<HTMLOutputElement>('route-value').value = `${Math.round(value * 100)}%`; };
    el<HTMLSelectElement>('landmark').onchange = () => { pause(session); void submit(session, { focus: el<HTMLSelectElement>('landmark').value, live: true }); };
    el('mechanism').textContent = 'One world and route sampler supplies the journey, minimap, and traces. Two labeled futures branch from the same present. Unmaking erodes the present after speculative outlines disappear.';
  }
  el('motion-note').textContent = reducedMotion.matches ? 'Reduced motion is active. Use presets and controls for explicit settled states.' : 'The live scene is silent. Film sound is composed separately from the same model.';
}

function pause(session: Session) { session.clock.pause(); cancelAnimationFrame(session.raf); session.raf = 0; session.player.pause(); sync(session); }
function playClock(session: Session) {
  if (!active(session) || reducedMotion.matches || session.suspended) return;
  session.clock.play(performance.now());
  if (!session.raf && session.tick) session.raf = requestAnimationFrame(session.tick);
  sync(session);
}
async function seek(session: Session, seconds: number) {
  if (session.study.kind === 'pointer') {
    session.driveRelease?.(); session.driveRelease = session.player.suspendDrive();
  }
  await submit(session, { ...(session.study.kind === 'pointer' ? { material: 'auto' } : {}) }, seconds);
}

function brushPoint(session: Session, event: PointerEvent) {
  return canvasPoint(event.clientX, event.clientY, el('brush').getBoundingClientRect());
}
function installBrush(session: Session) {
  const brush = el('brush'); let pointer: number | undefined; let sequence = 0; let x = .5; let y = .5;
  const update = () => { void submit(session, { strokes: session.strokes.strokes }); };
  const cursor = () => { el('brush-cursor').style.left = `${x * 100}%`; el('brush-cursor').style.top = `${y * 100}%`; el<HTMLInputElement>('brush-x').value = String(x); el<HTMLInputElement>('brush-y').value = String(y); };
  const down = (event: PointerEvent) => {
    if (session.suspended || !active(session)) return;
    const point = brushPoint(session, event); if (!point) return;
    pointer = event.pointerId; brush.setPointerCapture(pointer); x = point.x; y = point.y; cursor();
    session.strokes.begin(`brush-${++sequence}`, Number(el<HTMLSelectElement>('brush-size').value), { ...point, at: session.clock.seconds });
    playClock(session); update();
  };
  const move = (event: PointerEvent) => {
    const point = brushPoint(session, event); if (!point) return; x = point.x; y = point.y; cursor();
    if (pointer !== event.pointerId || session.suspended) return;
    session.strokes.append({ ...point, at: session.clock.seconds }); update();
  };
  const up = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    const point = brushPoint(session, event); if (point) session.strokes.append({ ...point, at: session.clock.seconds }, true);
    session.strokes.end(); pointer = undefined; update();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') x = Math.max(0, x - .02);
    else if (event.key === 'ArrowRight') x = Math.min(1, x + .02);
    else if (event.key === 'ArrowUp') y = Math.max(0, y - .02);
    else if (event.key === 'ArrowDown') y = Math.min(1, y + .02);
    else if (event.key === ' ') { disturb(session, x, y); event.preventDefault(); return; }
    else return;
    event.preventDefault(); cursor();
  };
  brush.addEventListener('pointerdown', down); brush.addEventListener('pointermove', move); brush.addEventListener('pointerup', up); brush.addEventListener('pointercancel', up); brush.addEventListener('lostpointercapture', up); brush.addEventListener('keydown', key);
  session.removeListeners.push(() => { brush.removeEventListener('pointerdown', down); brush.removeEventListener('pointermove', move); brush.removeEventListener('pointerup', up); brush.removeEventListener('pointercancel', up); brush.removeEventListener('lostpointercapture', up); brush.removeEventListener('keydown', key); });
  cursor();
}
function disturb(session: Session, x: number, y: number) {
  if (session.suspended) return;
  session.strokes.begin(`tap-${session.version + 1}`, Number(el<HTMLSelectElement>('brush-size').value), { x, y, at: session.clock.seconds }); session.strokes.end();
  void submit(session, { strokes: session.strokes.strokes });
  playClock(session);
}
function traceShore(session: Session) {
  const start = session.clock.seconds;
  session.strokes.begin(`trace-${session.version + 1}`, Number(el<HTMLSelectElement>('brush-size').value), { x: .28, y: .56, at: start });
  for (let i = 1; i < 40; i++) session.strokes.append({ x: .28 + i / 39 * .42, y: .56 - .16 * Math.sin(i / 39 * Math.PI), at: start + i / 39 * 2 });
  session.strokes.end(); void submit(session, { strokes: session.strokes.strokes });
  playClock(session);
}

async function freeze(options: { logicalSeconds?: number; frame?: number; data?: Record<string, unknown> } = {}): Promise<CaptureRecord> {
  const session = current; if (!session) throw new Error('No material study is loaded.');
  const before = await inspection.inspect({ surfaceId });
  const owned = await inspection.setMode({ surfaceId, expectedGeneration: before.generation, mode: 'inspection' });
  await session.pump.idle();
  session.clock.seek(options.logicalSeconds ?? session.clock.seconds);
  const seconds = session.clock.seconds;
  const outcome = await submit(session, options.data ?? {}, seconds, 'inspection', true);
  if (outcome !== 'accepted' || !active(session)) throw new Error('Capture input was superseded.');
  const frame = options.frame ?? (session.study.kind === 'interactive' ? session.player.currentFrame : frameAt(session, seconds));
  const snapshot = await inspection.seek({ surfaceId, expectedGeneration: owned.generation, frame });
  const shown = session.player.getPresentation();
  if (!shown.accepted || snapshot.presented?.revision !== shown.accepted.revision) throw new Error('Capture presentation changed.');
  // seek may create a fresh revision for the same frozen model input; bind only after it is accepted.
  bindAccepted(session, { data: session.data, seconds, version: session.version, requestedAt: performance.now(), source: 'inspection' });
  const readySnapshot = await inspection.inspect({ surfaceId });
  if (readySnapshot.readiness.status !== 'ready' || !session.accepted) throw new Error('Capture resources are not ready.');
  const record: CaptureRecord = { study: session.study.id, input: clone(session.accepted), snapshot: readySnapshot, fontHashes: MATERIAL_FONT_HASHES };
  session.capture = record;
  el('record').textContent = JSON.stringify(record, null, 2);
  note(`Frozen ${record.study}, input ${record.input.inputVersion}, accepted revision ${record.input.revision}.`);
  return record;
}
async function verify(record: CaptureRecord): Promise<boolean> {
  const session = current; if (!session || session.study.id !== record.study || !session.suspended) return false;
  const now = await inspection.inspect({ surfaceId });
  return now.generation === record.snapshot.generation && now.presented?.revision === record.snapshot.presented?.revision && now.presented?.frame === record.snapshot.presented?.frame && now.readiness.status === 'ready' && session.accepted?.recordId === record.input.recordId && session.accepted?.inputVersion === record.input.inputVersion;
}
async function release() {
  if (!current) return;
  const before = await inspection.inspect({ surfaceId });
  await inspection.setMode({ surfaceId, expectedGeneration: before.generation, mode: 'live' });
  current.capture = undefined; note('Live input restored.');
}

function benchmarkPort(session: Session): BenchmarkPort {
  return {
    studyId: session.study.id, fidelity: session.data.fidelity,
    pause: () => pause(session),
    reset: async () => { await submit(session, {}, session.study.settled, 'benchmark'); await session.pump.idle(); },
    settle: () => session.pump.idle(),
    frame: async (progress, mode) => {
      const logicalSeconds = session.study.id === 'returning-shore' ? progress * 8 : progress * (session.study.id === 'sandglass' ? 49 : session.study.seconds);
      const patch: Record<string, unknown> = mode === 'interaction' ? session.study.id === 'sandglass' ? { selectedRequest: 1 + Math.floor(progress * 47) } : session.study.id === 'cleft' ? { material: progress < .33 ? 'ink' : progress < .66 ? 'mineral' : 'graphite' } : session.study.id === 'borrowed-shapes' ? { followGrains: progress > .5 } : session.study.id === 'aster-basin' ? { routeProgress: progress, focus: 'route', live: true } : { strokes: [{ id: 'benchmark-brush', radius: .035, points: Array.from({length:Math.floor(logicalSeconds*30)+1},(_,frame)=>{const at=frame/30;return{x:.2+.6*at/8,y:.5+.08*Math.sin(at),at};}) }] } : session.study.id === 'aster-basin' ? { live: false } : {};
      await submit(session, patch, logicalSeconds, 'benchmark');
    },
    acceptances: () => session.acceptances,
    counters: () => ({ accepted: session.pump.accepted, coalesced: session.pump.coalesced, failures: session.pump.failures }),
    counts: () => grainCounts(session), runtimePerformance: () => session.player.getPerformance(),
  };
}
async function benchmark(options: Parameters<typeof runBenchmark>[1] = {}) {
  const session = current; if (!session) throw new Error('No material study is loaded.');
  await release(); pause(session);
  session.driveRelease?.(); session.driveRelease = session.player.suspendDrive();
  const result = await runBenchmark(benchmarkPort(session), options);
  if (!active(session)) throw new Error('The benchmark study changed.');
  benchmarkResults.push(result);
  el('record').textContent = JSON.stringify(result, null, 2); sync(session);
  return result;
}

document.querySelectorAll<HTMLButtonElement>('[data-study]').forEach((button) => { button.onclick = () => void select(button.dataset.study as StudyId); });
el('play').onclick = () => {
  if (!current || current.suspended || reducedMotion.matches) return;
  if (current.clock.playing) pause(current);
  else { if (current.clock.seconds >= current.clock.duration) current.clock.seek(0); playClock(current); }
};
el('reset').onclick = () => {
  if (!current || current.suspended) return; pause(current); current.strokes.reset();
  const seconds = current.study.id === 'sandglass' ? 0 : current.study.settled;
  void submit(current, { ...current.initial, fidelity: current.data.fidelity, strokes: [] }, seconds);
};
el<HTMLInputElement>('time').oninput = () => { if (current) { pause(current); void seek(current, Number(el<HTMLInputElement>('time').value)); } };
el<HTMLSelectElement>('fidelity').onchange = () => {
  if (!current) return;
  const fidelity = el<HTMLSelectElement>('fidelity').value as Fidelity;
  localStorage.setItem(`material-explicit-profile:${current.study.id}`, fidelity);
  current.previewChoice = choosePreview(current.study.id, current.sourceDigest, current.qualification, fidelity);
  void submit(current, { fidelity });
};
el('capture').onclick = () => void freeze().catch(fail);
el('release').onclick = () => void release().catch(fail);
el('benchmark').onclick = () => {
  benchmarkController = new AbortController(); el('stop-benchmark').hidden = false;
  void benchmark({ signal: benchmarkController.signal, onProgress: note }).catch(fail).finally(() => { benchmarkController = undefined; el('stop-benchmark').hidden = true; });
};
el('stop-benchmark').onclick = () => benchmarkController?.abort();
el('download').onclick = () => {
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, sessions, current: current?.accepted, capture: current?.capture, benchmarks: benchmarkResults, acceptances: current?.acceptances }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'material-studies-session.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const onMotion = () => {
  if (!current) return; pause(current);
  if (reducedMotion.matches) { current.driveRelease?.(); current.driveRelease = current.player.suspendDrive(); void seek(current, current.study.settled); }
  else { current.driveRelease?.(); current.driveRelease = undefined; }
  void submit(current, { reducedMotion: reducedMotion.matches });
  el('motion-note').textContent = reducedMotion.matches ? 'Reduced motion is active. Use controls for explicit settled states.' : 'Live input restored; films carry the designed sound.';
};
reducedMotion.addEventListener('change', onMotion);

const api = {
  select, refreshRoughs, refreshAvailability,
  update: async (data: Record<string, unknown>, logicalSeconds?: number) => { if (!current) throw new Error('No study is loaded.'); return submit(current, data, logicalSeconds ?? current.clock.seconds); },
  freeze, verify, release, benchmark,
  state: () => current ? { study: current.study.id, accepted: current.accepted, data: clone(current.data), suspended: current.suspended, clock: { seconds: current.clock.seconds, playing: current.clock.playing }, counts: grainCounts(current), performance: current.player.getPerformance() } : null,
  available: () => STUDIES.filter((study) => isAvailable(study.id)).map((study) => study.id),
};
declare global { interface Window { materialStudies?: typeof api; superimgInspection?: typeof inspection } }
window.materialStudies = api; window.superimgInspection = inspection;
el('watch-rough').onclick = () => showRough('clip');
el('watch-film').onclick = () => showRough('film');
el('view-poster').onclick = () => showRough('poster');
el('refresh-artifacts').onclick = () => void refreshRoughs().catch(fail);
el('close-rough').onclick = () => el<HTMLDialogElement>('rough-viewer').close();
el<HTMLDialogElement>('rough-viewer').addEventListener('close', () => el<HTMLVideoElement>('rough-video').pause());
function dispose() {
  if (disposed) return; disposed = true; epoch.dispose(); benchmarkController?.abort();
  if (current) disposeSession(current); current = undefined; inspection.dispose();
  reducedMotion.removeEventListener('change', onMotion);
  if (window.materialStudies === api) delete window.materialStudies;
  if (window.superimgInspection === inspection) delete window.superimgInspection;
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
const initialId = STUDIES.some((study) => study.id === location.hash.slice(1)) ? location.hash.slice(1) as StudyId : STUDIES.find((study) => isAvailable(study.id))?.id ?? 'sandglass';
void select(initialId);
void refreshRoughs().catch((error) => { el('rough-note').textContent = `Rough previews could not load: ${error instanceof Error ? error.message : String(error)}`; });
