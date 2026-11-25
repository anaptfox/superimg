import { createPreviewInspection, type PreviewInspection } from "@foxworth/superimg/inspection";
import type { Player } from "@foxworth/superimg/player";

declare global {
  interface Window {
    superimgInspection: PreviewInspection;
    disposeMarketingHost(): void;
  }
}

export function attachMarketingInspection(player: Player): void {
  const inspection = createPreviewInspection({ readinessTimeoutMs: 15_000 });
  const attachment = inspection.attach({
    surfaceId: "marketing-lockup",
    player,
    controls: ["set-mode", "seek-frame"],
  });
  window.superimgInspection = inspection;
  window.disposeMarketingHost = () => {
    attachment.dispose();
    inspection.dispose();
    player.dispose();
  };
}
