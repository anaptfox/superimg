/** The complete finite queue. Painting and sound consume these same facts. */
export const REQUEST_COUNT = 48;
export const GRAINS_PER_REQUEST = 12;
export const SERVICE_SECONDS = 2;
export const FILM_SECONDS = 40;
export type Fidelity = "full" | "reduced";
export type RequestState = "supply" | "waiting" | "processing" | "completed";

export interface SandglassData {
  teaching: boolean;
  fidelity: Fidelity;
  live: boolean;
  logicalSeconds: number;
  inputVersion: number;
  workers: number;
  compareWorkers: number;
  arrivalRate: number;
  compare: boolean;
  selectedRequest: number;
}

export const INITIAL_SANDGLASS: Readonly<SandglassData> = Object.freeze({
  teaching: false, fidelity: "full", live: false, logicalSeconds: 0,
  inputVersion: 0, workers: 2, compareWorkers: 4, arrivalRate: 2,
  compare: true, selectedRequest: 17,
});

export interface ScheduledRequest {
  readonly id: number;
  readonly arrival: number;
  readonly start: number;
  readonly end: number;
  readonly worker: number;
  readonly wait: number;
  readonly completionRank: number;
}
export interface RequestSnapshot extends ScheduledRequest {
  readonly state: RequestState;
  /** Elapsed wait before service, final wait thereafter. Never predicts future wait. */
  readonly visibleWait: number;
  readonly progress: number;
  readonly x: number;
  readonly y: number;
  readonly clusterId: string;
}
export interface QueueCounts {
  readonly supply: number;
  readonly waiting: number;
  readonly processing: number;
  readonly completed: number;
  readonly arrived: number;
}
export interface SystemSnapshot {
  readonly id: "primary" | "comparison";
  readonly workers: number;
  readonly requests: readonly RequestSnapshot[];
  readonly counts: QueueCounts;
  readonly finishSeconds: number;
  readonly meanWait: number;
  readonly maxWait: number;
}
export interface FilmClock {
  readonly logicalSeconds: number;
  readonly filmSeconds: number;
  readonly speed: number;
  readonly held: boolean;
}
export interface SandglassSnapshot {
  readonly clock: FilmClock;
  readonly inputVersion: number;
  readonly arrivalRate: number;
  readonly selectedRequest: number;
  readonly systems: readonly SystemSnapshot[];
  readonly logicalGrains: number;
  readonly drawnGrains: number;
}

const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));

function validateConfig(workers: number, arrivalRate: number): void {
  if (!Number.isInteger(workers) || workers < 1 || workers > 6) throw new RangeError("Workers must be an integer from 1 to 6");
  if (!Number.isFinite(arrivalRate) || arrivalRate < 0.5 || arrivalRate > 6 || !Number.isInteger(arrivalRate * 2)) throw new RangeError("Arrival rate must be 0.5–6 in steps of 0.5");
}

/** FIFO, with the lowest numbered worker winning equal availability. */
function buildSchedule(workers: number, arrivalRate: number): readonly ScheduledRequest[] {
  const available = Array.from({ length: workers }, () => 0);
  const jobs = Array.from({ length: REQUEST_COUNT }, (_, index) => {
    const id = index + 1;
    const arrival = id / arrivalRate;
    let worker = 0;
    for (let candidate = 1; candidate < workers; candidate++) if (available[candidate]! < available[worker]!) worker = candidate;
    const start = Math.max(arrival, available[worker]!);
    const end = start + SERVICE_SECONDS;
    available[worker] = end;
    return { id, arrival, start, end, worker, wait: start - arrival };
  });
  const completionOrder = [...jobs].sort((a, b) => a.end - b.end || a.id - b.id);
  const rank = new Map(completionOrder.map((job, index) => [job.id, index]));
  return Object.freeze(jobs.map(job => Object.freeze({ ...job, completionRank: rank.get(job.id)! })));
}

// All live settings are a bounded finite domain. Build once, before rendering;
// sampling never mutates a cache or allocates a second scheduling mechanism.
const SCHEDULES = new Map(Array.from({ length: 72 }, (_, index) => {
  const workers = Math.floor(index / 12) + 1;
  const rate = ((index % 12) + 1) / 2;
  return [`${workers}/${rate}`, buildSchedule(workers, rate)] as const;
}));

export function scheduleRequests(workers: number, arrivalRate: number): readonly ScheduledRequest[] {
  validateConfig(workers, arrivalRate);
  return SCHEDULES.get(`${workers}/${arrivalRate}`)!;
}

export function sampleFilmClock(seconds: number): FilmClock {
  if (!Number.isFinite(seconds)) throw new RangeError("Film time must be finite");
  const t = clamp(seconds, 0, FILM_SECONDS);
  const logicalSeconds = t < 3 ? 0 : t < 15 ? t - 3 : t < 19 ? 12
    : t < 25 ? 12 + (t - 19) * 2 : t < 27 ? 24
      : t < 35 ? 24 + (t - 27) * 3.125 : 49;
  const speed = t >= 3 && t < 15 ? 1 : t >= 19 && t < 25 ? 2 : t >= 27 && t < 35 ? 3.125 : 0;
  return Object.freeze({ logicalSeconds, filmSeconds: t, speed, held: speed === 0 });
}

/** First film instant at which a model event has happened; holds emit no repeats. */
export function filmTimeForSimulation(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 49) throw new RangeError("Canonical film events must lie in simulation 0–49");
  if (seconds === 0) return 0;
  if (seconds <= 12) return 3 + seconds;
  if (seconds <= 24) return 19 + (seconds - 12) / 2;
  return 27 + (seconds - 24) / 3.125;
}

/** Bottom-up triangular packing is completion order, not a statistical histogram. */
export function pilePosition(index: number): { x: number; y: number } {
  const rowSizes = [13, 11, 9, 7, 5, 3];
  let remaining = index;
  for (let row = 0; row < rowSizes.length; row++) {
    const width = rowSizes[row]!;
    if (remaining < width) return { x: (remaining - (width - 1) / 2) * 20, y: 534 - row * 14 };
    remaining -= width;
  }
  throw new RangeError("Pile index is outside the 48-request population");
}

function waitingPosition(index: number): { x: number; y: number } {
  const rowSizes = [3, 5, 7, 9, 11, 13];
  let remaining = index;
  for (let row = 0; row < rowSizes.length; row++) {
    const width = rowSizes[row]!;
    if (remaining < width) { const slot=remaining===0?0:Math.ceil(remaining/2)*(remaining%2?-1:1);return {x:slot*20,y:330-row*16}; }
    remaining -= width;
  }
  throw new RangeError("Waiting index is outside the 48-request population");
}

export function supplyPosition(id: number): { x: number; y: number } {
  return { x: ((id - 1) % 12 - 5.5) * 18.5, y: 143 - Math.floor((id - 1) / 12) * 14 };
}

function sampleSystem(id: SystemSnapshot["id"], workers: number, rate: number, seconds: number): SystemSnapshot {
  const schedule = scheduleRequests(workers, rate);
  const waiting = schedule.filter(job => seconds >= job.arrival && seconds < job.start);
  const recentStart = Math.max(-1,...schedule.filter(job=>job.wait>0&&job.start<=seconds).map(job=>job.start));
  const beforeShift = recentStart>=0?schedule.filter(job=>job.arrival<recentStart&&job.start>=recentStart):[];
  const shiftP=clamp((seconds-recentStart)/.18),settle=shiftP*shiftP*(3-2*shiftP);
  const requests: RequestSnapshot[] = schedule.map(job => {
    const state: RequestState = seconds < job.arrival ? "supply" : seconds < job.start ? "waiting" : seconds < job.end ? "processing" : "completed";
    const visibleWait = state === "supply" ? 0 : state === "waiting" ? seconds - job.arrival : job.wait;
    const progress = state === "processing" ? clamp((seconds - job.start) / SERVICE_SECONDS) : state === "completed" ? 1 : 0;
    let position = supplyPosition(job.id);
    if (state === "waiting") {
      position = waitingPosition(waiting.findIndex(item => item.id === job.id));
      const previousIndex=beforeShift.findIndex(item=>item.id===job.id);
      if(previousIndex>=0&&settle<1){const previous=waitingPosition(previousIndex);position={x:previous.x*(1-settle)+position.x*settle,y:previous.y*(1-settle)+position.y*settle};}
    } else if (state === "processing") {
      // Each real worker has one visible channel, and at most one cluster in it.
      position = { x: (job.worker - (workers - 1) / 2) * 25, y: 359 + progress * 64 };
    } else if (state === "completed") position = pilePosition(job.completionRank);
    return Object.freeze({ ...job, state, visibleWait, progress, ...position, clusterId: `${id}-request-${job.id}` });
  });
  const count = (state: RequestState) => requests.filter(job => job.state === state).length;
  return Object.freeze({
    id, workers, requests: Object.freeze(requests),
    counts: Object.freeze({ supply: count("supply"), waiting: count("waiting"), processing: count("processing"), completed: count("completed"), arrived: REQUEST_COUNT - count("supply") }),
    finishSeconds: Math.max(...schedule.map(job => job.end)),
    meanWait: schedule.reduce((sum, job) => sum + job.wait, 0) / REQUEST_COUNT,
    maxWait: Math.max(...schedule.map(job => job.wait)),
  });
}

export function sampleSandglass(data: Readonly<SandglassData>, clock: Readonly<{ logicalSeconds: number; filmSeconds?: number; speed?: number; held?: boolean }>): SandglassSnapshot {
  if (!Number.isFinite(clock.logicalSeconds) || clock.logicalSeconds < 0) throw new RangeError("Logical time must be finite and nonnegative");
  if (!Number.isInteger(data.selectedRequest) || data.selectedRequest < 1 || data.selectedRequest > REQUEST_COUNT) throw new RangeError("Selected request must be 1–48");
  const systems = [sampleSystem("primary", data.workers, data.arrivalRate, clock.logicalSeconds)];
  if (data.compare) systems.push(sampleSystem("comparison", data.compareWorkers, data.arrivalRate, clock.logicalSeconds));
  return Object.freeze({
    clock: Object.freeze({ logicalSeconds: clock.logicalSeconds, filmSeconds: clock.filmSeconds ?? 0, speed: clock.speed ?? 1, held: clock.held ?? false }),
    inputVersion: data.inputVersion, arrivalRate: data.arrivalRate, selectedRequest: data.selectedRequest,
    systems: Object.freeze(systems), logicalGrains: systems.length * REQUEST_COUNT * GRAINS_PER_REQUEST,
    // All grains are semantically protected. Reduced changes no request geometry.
    drawnGrains: systems.length * REQUEST_COUNT * GRAINS_PER_REQUEST,
  });
}

export function validateSnapshot(snapshot: SandglassSnapshot): readonly string[] {
  const failures: string[] = [];
  for (const system of snapshot.systems) {
    const unique = new Set(system.requests.map(job => job.clusterId));
    if (system.requests.length !== REQUEST_COUNT || unique.size !== REQUEST_COUNT) failures.push(`${system.id}:population`);
    const c = system.counts;
    if (c.supply + c.waiting + c.processing + c.completed !== REQUEST_COUNT || c.arrived !== c.waiting + c.processing + c.completed) failures.push(`${system.id}:conservation`);
    const workers = system.requests.filter(job => job.state === "processing").map(job => job.worker);
    if (workers.length > system.workers || new Set(workers).size !== workers.length) failures.push(`${system.id}:capacity`);
    for (const job of system.requests) {
      const t = snapshot.clock.logicalSeconds;
      const expected = t < job.arrival ? "supply" : t < job.start ? "waiting" : t < job.end ? "processing" : "completed";
      if (job.state !== expected) failures.push(`${job.clusterId}:premature-state`);
      if (![job.x, job.y, job.visibleWait, job.progress].every(Number.isFinite)) failures.push(`${job.clusterId}:finite`);
      const wait = t < job.arrival ? 0 : t < job.start ? t - job.arrival : job.wait;
      if (job.visibleWait !== wait) failures.push(`${job.clusterId}:future-wait`);
    }
  }
  return failures;
}

export function observeSandglass(snapshot: SandglassSnapshot) {
  const primary = snapshot.systems[0]!;
  const comparison = snapshot.systems[1];
  const selected = primary.requests[snapshot.selectedRequest - 1]!;
  return {
    logicalSeconds: snapshot.clock.logicalSeconds,
    inputVersion: snapshot.inputVersion,
    speed: snapshot.clock.speed,
    systems: snapshot.systems.length,
    logicalGrains: snapshot.logicalGrains,
    drawnGrains: snapshot.drawnGrains,
    valid: validateSnapshot(snapshot).length === 0,
    primary: { ...primary.counts, finishSeconds: primary.finishSeconds, meanWait: primary.meanWait, maxWait: primary.maxWait },
    comparison: comparison ? { ...comparison.counts, finishSeconds: comparison.finishSeconds, meanWait: comparison.meanWait, maxWait: comparison.maxWait } : null,
    selected: { id: selected.id, state: selected.state, arrival: selected.arrival, start: selected.start, end: selected.end, visibleWait: selected.visibleWait },
  };
}

export interface SandglassAudioEvent {
  readonly id: string;
  readonly systemId: SystemSnapshot["id"];
  readonly requestId: number;
  readonly event: "arrival" | "start" | "completion";
  readonly simulationSeconds: number;
  readonly filmSeconds: number;
}

export function canonicalAudioEvents(): readonly SandglassAudioEvent[] {
  const events: SandglassAudioEvent[] = [];
  for (const [systemId, workers] of [["primary", 2], ["comparison", 4]] as const) {
    for (const job of scheduleRequests(workers, 2)) {
      for (const [event, seconds] of [["arrival", job.arrival], ["start", job.start], ["completion", job.end]] as const) {
        events.push(Object.freeze({ id: `${systemId}/${job.id}/${event}`, systemId, requestId: job.id, event, simulationSeconds: seconds, filmSeconds: filmTimeForSimulation(seconds) }));
      }
    }
  }
  return Object.freeze(events.sort((a, b) => a.filmSeconds - b.filmSeconds || a.id.localeCompare(b.id)));
}
