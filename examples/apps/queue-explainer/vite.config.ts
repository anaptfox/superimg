import { defineConfig, loadEnv, type Plugin } from 'vite';
import { parseRequest, requestDirection } from './src/director.server.ts';

function director(apiKey: string, model: string): Plugin {
  return {
    name: 'queue-lab-director',
    configureServer(server) {
      let busy = false;
      server.middlewares.use('/api/direct', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const send = (status: number, value: unknown) => { res.statusCode = status; res.end(JSON.stringify(value)); };
        const host = req.headers.host ?? '';
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return send(403, { error: 'Local development only.' });
        if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: 'Origin not allowed.' });
        if (req.method === 'GET') return send(200, { available: !!apiKey && !!model });
        if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
        if (!apiKey || !model) return send(503, { error: 'Set OPENAI_API_KEY and OPENAI_MODEL on the dev server. Direct controls work without AI.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON.' });
        if (busy) return send(429, { error: 'The previous request is finishing. Try again shortly.' });
        busy = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        const disconnect = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', disconnect);
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 4096) { send(413, { error: 'Request too large.' }); return; }
          }
          let input;
          try { input = parseRequest(JSON.parse(body)); }
          catch { send(400, { error: 'Invalid request. Use 1–500 characters and valid queue inputs.' }); return; }
          const direction = await requestDirection(input, { apiKey, model, signal: controller.signal });
          if (!controller.signal.aborted) send(200, { direction });
        } catch (error) {
          if (!res.destroyed) send(502, { error: controller.signal.aborted ? 'AI timed out. No change was applied.' : error instanceof Error ? error.message : 'AI request failed.' });
        } finally {
          clearTimeout(timer);
          res.off('close', disconnect);
          busy = false;
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OPENAI_');
  return {
    plugins: [director(process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? '', process.env.OPENAI_MODEL ?? env.OPENAI_MODEL ?? '')],
    server: { host: '127.0.0.1', port: 4183, strictPort: true },
    test: { include: ['src/**/*.test.ts'], environment: 'node' },
  };
});
