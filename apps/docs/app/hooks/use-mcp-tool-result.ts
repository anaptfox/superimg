"use client";

import { useEffect, useState } from "react";

export interface McpToolResultPayload {
  structuredContent?: Record<string, unknown>;
  result?: {
    structuredContent?: Record<string, unknown>;
  };
  content?: unknown;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  method?: string;
  params?: {
    result?: McpToolResultPayload;
    structuredContent?: Record<string, unknown>;
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
export function useMcpToolResult() {
  const [result, setResult] = useState<McpToolResultPayload | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as JsonRpcMessage;
      if (!isObject(data)) return;

      if (data.method === "ui/notifications/tool-result") {
        const params = data.params;
        if (!isObject(params)) return;

        // Most hosts send result payload in params.result
        if (params.result && isObject(params.result)) {
          setResult(params.result);
          return;
        }

        // Some hosts may flatten structuredContent at params level
        if (isObject(params.structuredContent)) {
          setResult({ structuredContent: params.structuredContent });
        }
      }

      if (data.method === "ui/notifications/tool-input") {
        const params = data.params;
        if (isObject(params)) {
          setResult(params);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return result;
}
