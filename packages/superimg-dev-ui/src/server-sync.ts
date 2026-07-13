import { setStatus, showToast } from "./ui-feedback";
import { reloadTemplate } from "./main";

export function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    showToast("Connected for auto-reloading", "info");
    setStatus("Connected for auto-reloading");
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "reload") reloadTemplate();
    } catch {}
  };
  ws.onclose = () => {
    setStatus("Disconnected. Retrying...");
    setTimeout(connectWebSocket, 2000);
  };
}
