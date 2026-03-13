import { statusEl, toastContainer, errorPanel, errorPanelMessage } from "./dom";

export type ToastType = "success" | "error" | "info";

export function setStatus(message: string) {
  statusEl.textContent = message;
}

export function showToast(message: string, type: ToastType = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);

  const dismiss = () => {
    el.remove();
  };

  if (type === "error") {
    el.addEventListener("click", dismiss);
  } else if (type === "success" || type === "info") {
    setTimeout(dismiss, 3000);
  }
}

export function showError(message: string) {
  errorPanel.classList.remove("hidden");
  errorPanelMessage.textContent = message;
}

export function hideError() {
  errorPanel.classList.add("hidden");
}

export function showLoading() {
  const previewContainer = document.getElementById("preview-container") as HTMLDivElement;
  previewContainer?.classList.add("loading");
}

export function hideLoading() {
  const previewContainer = document.getElementById("preview-container") as HTMLDivElement;
  previewContainer?.classList.remove("loading");
}
