import { createFileRoute } from "@tanstack/react-router";
import {
  chat,
  chatParamsFromRequest,
  mergeAgentTools,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import { TimelineSchema, type ChatForwardedProps } from "#/lib/ai/schema";
import { createTextAdapter } from "#/lib/ai/providers.server";
import { enrichTopic } from "#/lib/ai/server-tools";
import { previewAccentDef } from "#/lib/ai/tools";

const serverTools = [enrichTopic];

const SYSTEM_PROMPT = `You create accurate chronological video timelines.

Workflow:
1. Call enrich_topic with the user's topic (requires user approval).
2. Optionally call preview_accent with the suggested accent from enrich_topic.
3. Return a structured timeline with 5-8 real events in chronological order.

Each event needs a date, short title, and one factual sentence (max 15 words).
Pick an accentColor that fits the topic — use enrich_topic.suggestedAccent when sensible.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const params = await chatParamsFromRequest(request);
          const forwarded = params.forwardedProps as ChatForwardedProps | undefined;

          const stream = chat({
            adapter: createTextAdapter(forwarded),
            messages: params.messages,
            tools: mergeAgentTools(serverTools, [
              ...params.tools,
              previewAccentDef,
            ]),
            outputSchema: TimelineSchema,
            stream: true,
            systemPrompts: [SYSTEM_PROMPT],
            threadId: params.threadId,
            runId: params.runId,
          });

          return toServerSentEventsResponse(stream);
        } catch (error) {
          if (error instanceof Response) return error;

          const message = error instanceof Error ? error.message : "Chat request failed";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});