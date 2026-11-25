import { describe, expect, it, vi } from 'vitest';
import { INITIAL } from './model.ts';
import { direction } from './commands.ts';
import { parseRequest, requestDirection } from './director.server.ts';
const request = { prompt: 'Half the workers', data: INITIAL };
function response(value: unknown) { return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }); }

describe('AI adapter', () => {
  it('sends bounded context, parses output, and uses server credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(direction('configure', { workers: 2 })) }] }] }));
    expect(await requestDirection(request, { apiKey: 'test-key', model: 'test-model', fetch: fetcher })).toEqual(direction('configure', { workers: 2 }));
    const call = fetcher.mock.calls[0]!;
    const options = call[1]!;
    expect(JSON.parse(String(options.body))).toMatchObject({ model: 'test-model', store: false, text: { format: { strict: true } } });
    expect(options.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });
  it('rejects refusal, incomplete output, invalid commands, and provider errors', async () => {
    const invalid = [
      response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }),
      response({ status: 'incomplete', output: [] }),
      response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(direction('configure', { workers: 99 })) }] }] }),
      new Response('provider detail', { status: 429 }),
    ];
    for (const res of invalid) await expect(requestDirection(request, { apiKey: 'test', model: 'test', fetch: vi.fn<typeof fetch>().mockResolvedValue(res) })).rejects.toThrow();
  });
  it('rejects oversized requests and invalid client state', () => {
    expect(() => parseRequest({ ...request, prompt: 'x'.repeat(501) })).toThrow();
    expect(() => parseRequest({ ...request, data: { ...INITIAL, workers: 100 } })).toThrow();
  });
});
