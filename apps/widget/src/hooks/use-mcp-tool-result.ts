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

/** Trusted origins for MCP message handling */
const TRUSTED_ORIGIN_PATTERNS = [
  /\.openai\.com$/,
  /\.chatgpt\.com$/,
  /\.oaiusercontent\.com$/,
  /^https?:\/\/localhost(:\d+)?$/,
];

function isTrustedOrigin(origin: string): boolean {
  return TRUSTED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
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
      try {
        // Validate origin for security
        if (event.origin && !isTrustedOrigin(event.origin)) {
          return;
        }

        const data = event.data;
        if (!isObject(data)) return;

        const message = data as JsonRpcMessage;

        if (message.method === "ui/notifications/tool-result") {
          const params = message.params;
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

        if (message.method === "ui/notifications/tool-input") {
          const params = message.params;
          if (isObject(params)) {
            setResult(params);
          }
        }
      } catch {
        // Silently ignore malformed messages
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return result;
}
