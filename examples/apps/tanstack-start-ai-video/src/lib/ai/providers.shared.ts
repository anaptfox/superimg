import type { ProviderId } from "#/lib/ai/schema";

export const DEFAULT_PROVIDER: ProviderId = "ollama";

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  ollama: "llama3.2",
  openai: "gpt-4o-mini",
};

export const PROVIDER_OPTIONS: { id: ProviderId; label: string; models: string[] }[] = [
  {
    id: "ollama",
    label: "Ollama (local)",
    models: ["llama3.2", "llama3.1", "mistral", "qwen2.5"],
  },
  {
    id: "openai",
    label: "OpenAI (direct)",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
];