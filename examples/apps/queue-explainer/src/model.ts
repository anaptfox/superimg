/** Application-owned, deterministic FIFO model. One job takes two seconds. */
export interface QueueData {
  workers: number;
  arrivalRate: number;
  highlightBacklog: boolean;
}
export const INITIAL: QueueData = { workers: 4, arrivalRate: 2, highlightBacklog: false };
export const DURATION = 24;
export const SERVICE_SECONDS = 2;
export interface Job { id: number; worker: number; arrival: number; start: number; end: number }

export function isQueueData(value: unknown): value is QueueData {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return Number.isInteger(d.workers) && Number(d.workers) >= 1 && Number(d.workers) <= 6
    && typeof d.arrivalRate === 'number' && Number.isFinite(d.arrivalRate)
    && d.arrivalRate >= 0.5 && d.arrivalRate <= 6
    && typeof d.highlightBacklog === 'boolean';
}

export function sampleQueue(seconds: number, data: QueueData) {
  if (!isQueueData(data) || !Number.isFinite(seconds)) throw new Error('Invalid queue inputs');
  const time = Math.max(0, Math.min(DURATION, seconds));
  const available = Array<number>(data.workers).fill(0);
  const jobs: Job[] = [];
  // First arrival is after one interval, so the initial queue is empty.
  const arrived = Math.floor(time * data.arrivalRate + 1e-9);
  for (let id = 1; id <= arrived; id++) {
    const arrival = id / data.arrivalRate;
    const worker = available.indexOf(Math.min(...available));
    const start = Math.max(arrival, available[worker]!);
    const end = start + SERVICE_SECONDS;
    available[worker] = end;
    jobs.push({ id, worker, arrival, start, end });
  }
  const completed = jobs.filter(job => job.end <= time + 1e-9).length;
  const waiting = jobs.filter(job => job.start > time + 1e-9).length;
  return { arrived, completed, waiting, busy: arrived - completed - waiting,
    capacity: data.workers / SERVICE_SECONDS, jobs };
}

export function explainQueue(seconds: number, data: QueueData): string {
  const q = sampleQueue(seconds, data);
  const comparison = data.arrivalRate > q.capacity
    ? `Arrivals exceed capacity by ${(data.arrivalRate - q.capacity).toFixed(1)} jobs/s, so the backlog grows over time.`
    : data.arrivalRate === q.capacity
      ? 'Arrivals match capacity. With these evenly spaced arrivals, the workers keep up after starting.'
      : 'Capacity exceeds arrivals, so these evenly spaced jobs do not build a sustained backlog.';
  return `At ${seconds.toFixed(1)}s: ${q.arrived} arrived = ${q.completed} completed + ${q.busy} processing + ${q.waiting} waiting. Each worker takes 2s per job; ${data.workers} workers can finish ${q.capacity} jobs/s. ${comparison}`;
}
