import { createInteractivePlayer } from '@foxworth/superimg/interactive/player';
import queue from './queue.media.ts';
import { INITIAL, DURATION, explainQueue, type QueueData } from './model.ts';
import { applyDirection, direction, parseDirection, RequestGate, type Direction } from './commands.ts';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <header><a class="wordmark" href="https://superimg.app">SuperImg <span>/ experiments</span></a><span class="edition">01 · QUEUE LAB</span></header>
    <section class="intro"><div><p class="eyebrow">AN EXPLANATION YOU CAN INTERRUPT</p><h1>What happens when<br>work arrives faster?</h1></div><p class="lede">Watch the queue. Change the conditions.<br>Ask it to explain what you see.</p></section>
    <section class="workspace" aria-label="Queue experiment">
      <div class="visual"><div id="player" aria-label="Animated queue diagram"></div>
        <div class="transport"><button id="play" disabled>Play</button><button id="replay" disabled>Replay</button><label class="scrubber"><span class="sr-only">Scenario time</span><input id="time" type="range" min="0" max="24" step="0.1" value="0" disabled></label><output id="clock">0.0 / 24s</output></div>
      </div>
      <aside><p class="eyebrow">CHANGE THE CONDITIONS</p>
        <label class="setting" for="workers">Workers <output id="worker-count">4</output></label><input id="workers" type="range" min="1" max="6" step="1" value="4" disabled>
        <label class="setting" for="arrivals">Arrivals <output id="arrival-count">2 jobs/s</output></label><input id="arrivals" type="range" min="0.5" max="6" step="0.5" value="2" disabled>
        <p class="hint">Each job takes 2 seconds. Parameter changes replay the scenario from zero.</p>
        <div class="quick"><button id="half" disabled>Half the workers</button><button id="highlight" aria-pressed="false" disabled>Highlight backlog</button><button id="explain" disabled>Pause & explain</button></div>
        <div class="ask"><div class="ask-heading"><label for="prompt">Direct it in your own words</label><span id="ai-state">Checking AI…</span></div>
          <form id="ask"><textarea id="prompt" rows="2" maxlength="500" placeholder="What if we had half as many workers?" disabled></textarea><div class="ask-actions"><button id="send" type="submit" disabled>Ask AI <span>↗</span></button><button id="cancel" type="button" hidden>Cancel</button></div></form>
          <p class="hint" id="ai-hint">AI selects from the same controls above.</p>
        </div>
      </aside>
    </section>
    <section class="explanation"><p class="eyebrow">WHAT YOU’RE SEEING</p><p id="explanation">Press Play to see evenly spaced jobs arrive and workers process them.</p><p id="status" role="status" aria-live="polite">Loading the scene…</p></section>
    <details><summary>Experiment record <span id="event-count">0 actions</span></summary><p class="hint">Accepted changes, scenario times, and response latency. Download a record to compare direct controls with AI.</p><button id="download">Download JSON</button><ol id="history"></ol></details>
    <footer><span>Authored with SuperImg. Directed by you.</span><span>Deterministic FIFO · evenly spaced arrivals · no randomness</span></footer>
  </main>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = el('status');
const gate = new RequestGate();
let data: QueueData = { ...INITIAL };
let aiAvailable = false;
let ready = false;
let serial = Promise.resolve();
const events: Array<Record<string, unknown>> = [];
const interactive = createInteractivePlayer<QueueData>({ container: '#player', playbackMode: 'once' });
const player = interactive.player;
function note(message: string) { status.textContent = message; }
function record(value: Record<string, unknown>) {
  const event = { at: new Date().toISOString(), ...value };
  events.push(event);
  el('event-count').textContent = `${events.length} actions`;
  const li = document.createElement('li');
  li.textContent = `${value.source ?? 'viewer'} · ${value.label ?? value.action ?? value.outcome}`;
  el('history').prepend(li);
}
function busy(value: boolean) {
  el<HTMLButtonElement>('send').disabled = value || !aiAvailable || !ready;
  el<HTMLButtonElement>('cancel').hidden = !value;
}
function invalidate() { gate.invalidate(); busy(false); }
function sync() {
  el<HTMLOutputElement>('worker-count').value = String(data.workers);
  el<HTMLInputElement>('workers').value = String(data.workers);
  el<HTMLOutputElement>('arrival-count').value = `${data.arrivalRate} jobs/s`;
  el<HTMLInputElement>('arrivals').value = String(data.arrivalRate);
  el('highlight').setAttribute('aria-pressed', String(data.highlightBacklog));
  el('play').textContent = player.isPlaying ? 'Pause' : 'Play';
  el<HTMLInputElement>('time').value = String(player.currentTimeSeconds);
  el('clock').textContent = `${player.currentTimeSeconds.toFixed(1)} / ${DURATION}s`;
}
function enqueue(task: () => Promise<void>) {
  serial = serial.then(task).catch(error => note(error instanceof Error ? error.message : 'Could not update scene.'));
  return serial;
}
async function apply(command: Direction, source: 'direct' | 'AI', label: string, latencyMs?: number) {
  const checked = parseDirection(command);
  const before = { ...data };
  const atSeconds = player.currentTimeSeconds;
  if (checked.action === 'unsupported') {
    note('Try changing workers or arrivals, highlighting the backlog, pausing, resuming, replaying, or asking for an explanation.');
    record({ source, label, outcome: 'unsupported', latencyMs });
    return;
  }
  const next = applyDirection(data, checked);
  if (checked.action === 'configure' || checked.action === 'replay') {
    player.pause();
    await player.seek({ seconds: 0 });
    await interactive.setData(next);
    data = next;
    player.play();
  } else if (checked.action === 'highlight') {
    await interactive.setData(next);
    data = next;
  } else if (checked.action === 'pause' || checked.action === 'explain') player.pause();
  else if (checked.action === 'resume') {
    if (player.currentTimeSeconds >= DURATION - 1 / player.fps) await player.seek({ seconds: 0 });
    player.play();
  }
  sync();
  el('explanation').textContent = explainQueue(player.currentTimeSeconds, data);
  note(checked.action === 'configure' ? 'New conditions applied. Replaying from zero.' : checked.action === 'explain' ? 'Paused here. The explanation is calculated from this frame.' : 'Direction applied.');
  record({ source, label, command: checked, before, after: { ...data }, atSeconds, latencyMs });
}
function direct(command: Direction, label: string) { invalidate(); void enqueue(() => apply(command, 'direct', label)); }
el('play').onclick = () => direct(direction(player.isPlaying ? 'pause' : 'resume'), player.isPlaying ? 'Pause' : 'Play');
el('replay').onclick = () => direct(direction('replay'), 'Replay');
el('half').onclick = () => direct(direction('configure', { workers: Math.max(1, Math.floor(data.workers / 2)) }), 'Half the workers');
el('highlight').onclick = () => direct(direction('highlight', { highlightBacklog: !data.highlightBacklog }), 'Toggle backlog highlight');
el('explain').onclick = () => direct(direction('explain'), 'Pause and explain');
el<HTMLInputElement>('workers').onchange = event => direct(direction('configure', { workers: Number((event.target as HTMLInputElement).value) }), 'Change workers');
el<HTMLInputElement>('arrivals').onchange = event => direct(direction('configure', { arrivalRate: Number((event.target as HTMLInputElement).value) }), 'Change arrival rate');
el<HTMLInputElement>('time').oninput = event => {
  invalidate();
  const seconds = Number((event.target as HTMLInputElement).value);
  player.pause();
  void enqueue(async () => { await player.seek({ seconds }); sync(); el('explanation').textContent = explainQueue(seconds, data); });
};
el<HTMLInputElement>('time').onchange = () => record({ source: 'direct', label: 'Seek', atSeconds: Number(el<HTMLInputElement>('time').value) });
el('cancel').onclick = () => { invalidate(); note('Request cancelled. No AI change was applied.'); record({ source: 'AI', outcome: 'cancelled' }); };
el('ask').onsubmit = event => {
  event.preventDefault();
  const prompt = el<HTMLTextAreaElement>('prompt').value.trim();
  if (!prompt || !aiAvailable || !ready) return;
  const ticket = gate.begin();
  busy(true);
  note('Interpreting your direction… You can keep using the controls.');
  const start = performance.now();
  void (async () => {
    try {
      await serial;
      if (!gate.accepts(ticket.revision)) return;
      const response = await fetch('/api/direct', { method: 'POST', signal: ticket.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'AI request failed.');
      const command = parseDirection(result.direction);
      await enqueue(async () => {
        if (!gate.accepts(ticket.revision)) return;
        await apply(command, 'AI', prompt, Math.round(performance.now() - start));
      });
    } catch (error) {
      if (gate.accepts(ticket.revision)) {
        note(error instanceof Error ? error.message : 'AI request failed.');
        record({ source: 'AI', label: prompt, outcome: 'failed', latencyMs: Math.round(performance.now() - start) });
      }
    } finally { if (gate.accepts(ticket.revision)) busy(false); }
  })();
};
el('download').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, experiment: 'queue-lab', initial: INITIAL, current: data, events }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'queue-lab-session.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
player.on('frame', () => { if (ready) sync(); });
player.on('play', () => { if (ready) sync(); });
player.on('pause', () => { if (ready) sync(); });
player.on('ended', () => { sync(); el('explanation').textContent = explainQueue(player.currentTimeSeconds, data); note('Scenario complete. Change a condition or replay.'); });
interactive.on('error', error => note(error.message));
async function start() {
  const result = await interactive.load(queue, { data });
  if (result.status !== 'success') throw new Error(result.message);
  ready = true;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.transport button, .transport input, .quick button, aside > input').forEach(control => control.disabled = false);
  sync(); note('Ready. Press Play or try a different setup.');
  try { const response = await fetch('/api/direct'); aiAvailable = response.ok && (await response.json()).available === true; } catch { aiAvailable = false; }
  el('ai-state').textContent = aiAvailable ? 'Connected' : 'Optional · not connected';
  el<HTMLTextAreaElement>('prompt').disabled = !aiAvailable;
  el('ai-hint').textContent = aiAvailable ? 'AI selects the same controls. Numbers and explanations come from the queue model.' : 'Direct controls are ready. To enable AI, set OPENAI_API_KEY and OPENAI_MODEL on the local dev server.';
  busy(false);
}
void start().catch(error => note(`Could not load the scene: ${error.message}`));
if (import.meta.hot) import.meta.hot.dispose(() => { gate.invalidate(); interactive.dispose(); });
