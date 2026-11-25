import { directionSchema, parseDirection, type Direction } from './commands.ts';
import { isQueueData, type QueueData } from './model.ts';

export interface DirectionRequest { prompt: string; data: QueueData }
export function parseRequest(value: unknown): DirectionRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid request');
  const r = value as Record<string, unknown>;
  if (typeof r.prompt !== 'string' || !r.prompt.trim() || r.prompt.length > 500 || !isQueueData(r.data)) {
    throw new Error('Use a request of 1–500 characters and valid queue inputs.');
  }
  return { prompt: r.prompt.trim(), data: r.data };
}

/** Server-only adapter. It proposes a bounded direction; the host applies it. */
export async function requestDirection(
  input: DirectionRequest,
  options: { apiKey: string; model: string; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<Direction> {
  const request = parseRequest(input);
  const response = await (options.fetch ?? fetch)('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: options.signal,
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model, store: false,
      instructions: `Translate one viewer request into one queue-lab direction. This is a deterministic FIFO queue with evenly spaced arrivals, workers 1..6, arrivalRate 0.5..6 jobs/s, and 2 seconds per job. Current state is supplied. Resolve relative requests against it. For half the workers, round down, minimum 1. configure restarts the scenario. explain pauses and the app computes an exact explanation. highlight only changes highlightBacklog. pause/resume/replay do what they say. For unsupported, ambiguous, multi-action, or out-of-range requests return unsupported. Do not silently clamp requests except half-workers. Return null for every unused field. Never invent capabilities or explanatory numbers.`,
      input: JSON.stringify(request),
      text: { format: { type: 'json_schema', name: 'queue_direction', strict: true, schema: directionSchema } },
    }),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}. Check server configuration or try again.`);
  const body = await response.json() as { status?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (body.status !== 'completed') throw new Error('AI did not complete a direction. No change was applied.');
  const text = body.output?.filter(item => item.type === 'message')
    .flatMap(item => item.content ?? []).filter(item => item.type === 'output_text')
    .map(item => item.text ?? '').join('');
  if (!text) throw new Error('AI did not return a direction. No change was applied.');
  return parseDirection(JSON.parse(text));
}
