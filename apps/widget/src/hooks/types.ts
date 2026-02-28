export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

export type DisplayMode = "pip" | "inline" | "fullscreen";

export interface OpenAIGlobals {
  theme: "light" | "dark";
  displayMode: DisplayMode;
  maxHeight: number;
  toolOutput: unknown;
  widgetState: unknown;
  safeArea: { top: number; right: number; bottom: number; left: number };
  locale: string;
  userAgent: string;
}

export type SetGlobalsEvent = CustomEvent<{
  globals: Partial<OpenAIGlobals>;
}>;

export interface CallToolResponse {
  result: unknown;
}

declare global {
  interface Window {
    openai?: {
      [K in keyof OpenAIGlobals]?: OpenAIGlobals[K];
    } & {
      callTool?: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<CallToolResponse | null>;
      sendFollowUpMessage?: (params: { prompt: string }) => Promise<void>;
      openExternal?: (params: { href: string }) => void;
      requestDisplayMode?: (params: {
        mode: DisplayMode;
      }) => Promise<{ mode: DisplayMode }>;
      setWidgetState?: (state: unknown) => void;
      notifyIntrinsicHeight?: (height: number) => void;
      requestClose?: () => void;
    };
    __isChatGptApp?: boolean;
    innerBaseUrl?: string;
  }
}
