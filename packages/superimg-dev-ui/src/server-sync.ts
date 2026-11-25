import { setStatus, showToast } from "./ui-feedback";

export interface PreviewSyncHandlers {
  reloadTemplate: () => void;
  refreshMediaIR: () => Promise<void> | void;
  applyMarkupUpdate: () => Promise<void>;
  applyIntentCompatibleUpdate: (playheadFrame?: number) => Promise<void>;
  applyClockChangeUpdate: (playheadFrame?: number) => Promise<void>;
  applyCompileErrorStale: (message: string) => void;
}

export function connectWebSocket(handlers: PreviewSyncHandlers) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    showToast("Connected for auto-reloading", "info");
    setStatus("Connected for auto-reloading");
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as {
        type?: string;
        nextPlayheadFrame?: number;
        keepStalePreview?: boolean;
        message?: string;
      };
      if (msg.type === "no-change") {
        showToast("No media change", "info");
        setStatus("No media change (intent+markup unchanged)");
        return;
      }
      if (msg.type === "markup-update") {
        void handlers.applyMarkupUpdate();
        return;
      }
      if (msg.type === "intent-compatible") {
        void handlers.applyIntentCompatibleUpdate(msg.nextPlayheadFrame);
        return;
      }
      if (msg.type === "clock-change") {
        void handlers.applyClockChangeUpdate(msg.nextPlayheadFrame);
        return;
      }
      if (msg.type === "compile-error") {
        handlers.applyCompileErrorStale(msg.message ?? "Template compile failed");
        return;
      }
      if (msg.type === "reload") {
        handlers.reloadTemplate();
        return;
      }
      if (msg.type === "ir-update") {
        void handlers.refreshMediaIR();
      }
    } catch {
      /* ignore */
    }
  };
  ws.onclose = () => {
    setStatus("Disconnected. Retrying...");
    setTimeout(() => connectWebSocket(handlers), 2000);
  };
}
