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
      // Tool data
      toolInput?: Record<string, unknown>;
      toolOutput?: Record<string, unknown>;
      toolResponseMetadata?: Record<string, unknown>;

      // State
      widgetState?: unknown;
      setWidgetState?: (state: unknown) => void;

      // Environment
      theme?: "light" | "dark";
      displayMode?: DisplayMode;
      maxHeight?: number;
      safeArea?: { top: number; right: number; bottom: number; left: number };
      locale?: string;
      userAgent?: string;

      // Actions
      callTool?: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<CallToolResponse | null>;
      sendFollowUpMessage?: (params: {
        prompt: string;
        scrollToBottom?: boolean;
      }) => Promise<void>;
      uploadFile?: (file: File) => Promise<{ fileId: string }>;
      getFileDownloadUrl?: (params: {
        fileId: string;
      }) => Promise<{ url: string }>;
      requestDisplayMode?: (params: {
        mode: DisplayMode;
      }) => Promise<{ mode: string }>;
      requestModal?: (params: { template: string }) => Promise<unknown>;
      notifyIntrinsicHeight?: (height: number) => void;
      requestClose?: () => void;
      openExternal?: (params: { href: string }) => void;
    };
    __isChatGptApp?: boolean;
    innerBaseUrl?: string;
  }
}

export {};
