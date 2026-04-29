import { previewContainer, bgTypeSelect, bgColorRow, settingsBtn, settingsPanel } from "./dom";

const PREVIEW_BG_KEY = "superimg-dev-preview-bg";

type BgType = "checkerboard" | "solid";

interface PreviewBgSettings {
  type: BgType;
  color: string;
}

const DEFAULT_BG: PreviewBgSettings = { type: "checkerboard", color: "#2a2a2a" };

function loadPreviewBgSettings(): PreviewBgSettings {
  try {
    const s = localStorage.getItem(PREVIEW_BG_KEY);
    if (s) {
      const parsed = JSON.parse(s) as Partial<PreviewBgSettings>;
      return { type: parsed.type ?? DEFAULT_BG.type, color: parsed.color ?? DEFAULT_BG.color };
    }
  } catch {}
  return { ...DEFAULT_BG };
}

function savePreviewBgSettings(settings: PreviewBgSettings) {
  try {
    localStorage.setItem(PREVIEW_BG_KEY, JSON.stringify(settings));
  } catch {}
}

function applyPreviewBackground(settings: PreviewBgSettings) {
  if (!previewContainer) return;
  previewContainer.classList.remove("preview-bg-checkerboard");
  previewContainer.style.backgroundImage = "";
  previewContainer.style.backgroundColor = "";

  if (settings.type === "checkerboard") {
    previewContainer.classList.add("preview-bg-checkerboard");
  } else {
    previewContainer.style.backgroundColor = settings.color;
  }
}

export function setupPreviewBackgroundSettings() {
  const settings = loadPreviewBgSettings();
  applyPreviewBackground(settings);

  bgTypeSelect.value = settings.type;
  bgColorRow.classList.toggle("hidden", settings.type !== "solid");

  settingsBtn.addEventListener("click", () => {
    const open = settingsPanel.classList.toggle("hidden");
    settingsBtn.setAttribute("aria-expanded", String(!open));
  });

  bgTypeSelect.addEventListener("change", () => {
    const type = bgTypeSelect.value as BgType;
    bgColorRow.classList.toggle("hidden", type !== "solid");
    const newSettings: PreviewBgSettings = { ...loadPreviewBgSettings(), type };
    if (type === "solid") newSettings.color = loadPreviewBgSettings().color;
    savePreviewBgSettings(newSettings);
    applyPreviewBackground(newSettings);
  });

  bgColorRow.querySelectorAll(".bg-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = (btn as HTMLButtonElement).dataset.color ?? DEFAULT_BG.color;
      const newSettings: PreviewBgSettings = { type: "solid", color };
      savePreviewBgSettings(newSettings);
      applyPreviewBackground(newSettings);
      bgTypeSelect.value = "solid";
      bgColorRow.classList.remove("hidden");
    });
  });
}
