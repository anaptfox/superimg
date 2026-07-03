import { createOllamaChat, ollamaText } from "@tanstack/ai-ollama";
import { openaiText } from "@tanstack/ai-openai";
import type { ChatForwardedProps } from "#/lib/ai/schema";
import { DEFAULT_MODELS, DEFAULT_PROVIDER } from "#/lib/ai/providers.shared";

export function resolveProviderConfig(forwarded?: ChatForwardedProps) {
  const provider = forwarded?.provider ?? DEFAULT_PROVIDER;
  const model =
    forwarded?.model ??
    (provider === "ollama"
      ? (process.env.OLLAMA_MODEL ?? DEFAULT_MODELS.ollama)
      : (process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai));
  return { provider, model };
}

export function createTextAdapter(forwarded?: ChatForwardedProps) {
  const { provider, model } = resolveProviderConfig(forwarded);

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set — switch provider to Ollama or add a key");
    }
    return openaiText(model);
  }

  const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  return host === "http://localhost:11434"
    ? ollamaText(model)
    : createOllamaChat(model, host);
}