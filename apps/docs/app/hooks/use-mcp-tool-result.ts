"use client";

import { useEffect, useState } from "react";

interface JsonRpcMessage {
  jsonrpc?: string;
  method?: string;
  params?: {
    result?: unknown;
    structuredContent?: unknown;
    [key: string]: unknown;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Standard MCP Apps bridge listener.
 *
 * Listens for JSON-RPC messages posted by the host using:
 * - ui/notifications/tool-result
 * - ui/notifications/tool-input (fallback shape in some hosts)
 */
export function useMcpToolResult<T extends Record<string, unknown>>() {
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as JsonRpcMessage;
      if (!isObject(data)) return;

      if (data.method === "ui/notifications/tool-result") {
        const params = data.params;
        if (!isObject(params)) return;

        // Most hosts send result payload in params.result
        if (isObject(params.result)) {
          setResult(params.result as T);
          return;
        }

        // Some hosts may flatten structuredContent at params level
        if (isObject(params.structuredContent)) {
          setResult({ structuredContent: params.structuredContent } as unknown as T);
        }
      }

      if (data.method === "ui/notifications/tool-input") {
        const params = data.params;
        if (isObject(params)) {
          setResult(params as T);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return result;
}
