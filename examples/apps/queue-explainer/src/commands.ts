import { isQueueData, type QueueData } from './model.ts';

export const ACTIONS = ['configure', 'highlight', 'pause', 'resume', 'replay', 'explain', 'unsupported'] as const;
export type Action = typeof ACTIONS[number];
export interface Direction {
  action: Action;
  workers: number | null;
  arrivalRate: number | null;
  highlightBacklog: boolean | null;
}
export const directionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ACTIONS },
    workers: { type: ['integer', 'null'], minimum: 1, maximum: 6 },
    arrivalRate: { type: ['number', 'null'], minimum: 0.5, maximum: 6 },
    highlightBacklog: { type: ['boolean', 'null'] },
  },
  required: ['action', 'workers', 'arrivalRate', 'highlightBacklog'],
};
export function direction(action: Action, fields: Partial<Omit<Direction, 'action'>> = {}): Direction {
  return { action, workers: null, arrivalRate: null, highlightBacklog: null, ...fields };
}
export function parseDirection(value: unknown): Direction {
  if (!value || typeof value !== 'object') throw new Error('Invalid direction');
  const d = value as Record<string, unknown>;
  if (Object.keys(d).length !== 4 || !ACTIONS.includes(d.action as Action)
    || !(d.workers === null || (Number.isInteger(d.workers) && Number(d.workers) >= 1 && Number(d.workers) <= 6))
    || !(d.arrivalRate === null || (typeof d.arrivalRate === 'number' && Number.isFinite(d.arrivalRate) && d.arrivalRate >= 0.5 && d.arrivalRate <= 6))
    || !(d.highlightBacklog === null || typeof d.highlightBacklog === 'boolean')) throw new Error('Invalid direction');
  if (d.action !== 'configure' && (d.workers !== null || d.arrivalRate !== null)) throw new Error('Unexpected parameter change');
  if (d.action !== 'highlight' && d.highlightBacklog !== null) throw new Error('Unexpected highlight change');
  if (d.action === 'configure' && d.workers === null && d.arrivalRate === null) throw new Error('Empty configuration');
  if (d.action === 'highlight' && d.highlightBacklog === null) throw new Error('Missing highlight value');
  return d as unknown as Direction;
}
export function applyDirection(data: QueueData, value: Direction): QueueData {
  const d = parseDirection(value);
  const next = { ...data,
    ...(d.workers !== null ? { workers: d.workers } : {}),
    ...(d.arrivalRate !== null ? { arrivalRate: d.arrivalRate } : {}),
    ...(d.highlightBacklog !== null ? { highlightBacklog: d.highlightBacklog } : {}),
  };
  if (!isQueueData(next)) throw new Error('Invalid queue configuration');
  return next;
}
/** A new user intention invalidates every older in-flight model response. */
export class RequestGate {
  private revision = 0;
  private controller?: AbortController;
  invalidate() { this.controller?.abort(); this.controller = undefined; return ++this.revision; }
  begin() { const revision = this.invalidate(); this.controller = new AbortController(); return { revision, signal: this.controller.signal }; }
  accepts(revision: number) { return revision === this.revision; }
}
