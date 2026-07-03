# SuperImg × TanStack Start + TanStack AI

AI-generated timeline videos using [TanStack AI](https://tanstack.com/ai) (not Vercel AI SDK), [TanStack Start](https://tanstack.com/start), and SuperImg.

Demonstrates:

- **Headless client** — `useChat` + `createChatClientOptions` from `@tanstack/ai-react` / `@tanstack/ai-client`
- **AG-UI SSE** — `chatParamsFromRequest` → `chat()` → `toServerSentEventsResponse`
- **Provider adapters** — Ollama (local, default) or OpenAI (direct API, no gateway)
- **Typed tools** — `toolDefinition()` with `.server()` and `.client()` implementations
- **Tool approval** — `enrich_topic` server tool pauses until the user approves
- **Structured output** — `TimelineSchema` streams via `partial` / `final` on `useChat`
- **Media** — SuperImg `<Player>` preview + `usePlaygroundExport` MP4 download

## Setup

Runs fully locally with Ollama — no API keys required.

```bash
# One-time: pull the model
ollama pull llama3.2

# From monorepo root
just install
cd examples/apps/tanstack-start-ai-video && pnpm install && pnpm dev
```

Ollama must be running (`ollama serve`). Optional env:

```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
OPENAI_API_KEY=...   # only if using OpenAI provider in the UI
```

Open [http://localhost:3002](http://localhost:3002).

## File structure

```
src/
  lib/ai/
    schema.ts         Zod TimelineSchema + provider types
    tools.ts          Isomorphic tool definitions
    server-tools.ts   Server tool implementations
    providers.shared.ts  Client provider/model options
    providers.server.ts  Adapter factory (Ollama / OpenAI)
  components/
    ChatStream.tsx    Message parts + approval UI
    StreamingTimeline.tsx  partial/final structured output
    ToolApprovalCard.tsx
  routes/
    api/chat.ts       SSE chat route
    index.tsx         useChat + SuperImg Player
  lib/template.ts     define() timeline template
```

## Server route

```ts
const params = await chatParamsFromRequest(request);
const stream = chat({
  adapter: createTextAdapter(params.forwardedProps),
  messages: params.messages,
  tools: mergeAgentTools(serverTools, params.tools),
  outputSchema: TimelineSchema,
  stream: true,
});
return toServerSentEventsResponse(stream);
```

## Client

```tsx
const { messages, sendMessage, partial, final, addToolApprovalResponse } = useChat({
  connection: fetchServerSentEvents("/api/chat"),
  tools: clientTools(previewAccent),
  outputSchema: TimelineSchema,
  forwardedProps: { provider: "ollama", model: "llama3.2" },
});
```

Provider and model are switched in the UI via `forwardedProps` — no code changes needed.