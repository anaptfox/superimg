import { useEffect, useState, useSyncExternalStore } from "react";

interface ToolResultParams {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Receives tool results via MCP Apps bridge.
 * Returns the structuredContent from the tool response.
 */
export function useMcpToolResult(): Record<string, unknown> | null {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;

      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method !== "ui/notifications/tool-result") return;

      const params = message.params as ToolResultParams | undefined;
      if (params?.structuredContent && isObject(params.structuredContent)) {
        setResult(params.structuredContent);
      }
    };

    window.addEventListener("message", onMessage, { passive: true });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Fallback: window.openai.toolOutput (for initial load)
  const globalOutput = useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => onChange();
      window.addEventListener("openai:set_globals", handler);
      return () => window.removeEventListener("openai:set_globals", handler);
    },
    () => {
      if (typeof window === "undefined") return null;
      const output = window.openai?.toolOutput;
      return isObject(output) ? output : null;
    },
    () => null
  );

  return result ?? globalOutput;
}
