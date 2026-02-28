import { useCallback, useSyncExternalStore } from "react";
import { useOpenAIGlobal } from "./use-openai-global";
import type { DisplayMode } from "./types";

export { useOpenAIGlobal } from "./use-openai-global";
export { useMcpToolResult } from "./use-mcp-tool-result";
export type { DisplayMode, OpenAIGlobals } from "./types";

/** Type-safe access to tool output delivered by ChatGPT */
export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  const toolOutput = useOpenAIGlobal("toolOutput") as T;
  const fallback =
    typeof defaultState === "function"
      ? (defaultState as () => T | null)()
      : defaultState ?? null;
  return toolOutput ?? (fallback as T);
}

/** Current display mode (inline / pip / fullscreen) */
export function useDisplayMode(): DisplayMode | null {
  return useOpenAIGlobal("displayMode");
}

/** Max height constraint from the ChatGPT host */
export function useMaxHeight(): number | null {
  return useOpenAIGlobal("maxHeight");
}

/** Request a display mode change */
export function useRequestDisplayMode() {
  return useCallback(async (mode: DisplayMode) => {
    if (typeof window !== "undefined" && window.openai?.requestDisplayMode) {
      return window.openai.requestDisplayMode({ mode });
    }
    return { mode };
  }, []);
}

/** Send a follow-up chat message */
export function useSendMessage() {
  return useCallback((prompt: string) => {
    if (typeof window !== "undefined" && window.openai?.sendFollowUpMessage) {
      return window.openai.sendFollowUpMessage({ prompt });
    }
    return Promise.resolve();
  }, []);
}

/** Call an MCP tool from within the widget */
export function useCallTool() {
  return useCallback(
    async (name: string, args: Record<string, unknown>) => {
      if (typeof window !== "undefined" && window.openai?.callTool) {
        return window.openai.callTool(name, args);
      }
      return null;
    },
    []
  );
}

/** Whether the page is running inside a ChatGPT iframe */
export function useIsChatGptApp(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined" ? window.__isChatGptApp ?? false : false,
    () => false
  );
}
