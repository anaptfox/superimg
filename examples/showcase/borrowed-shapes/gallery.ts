import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { INITIAL_FORMS, observeForms, sampleForms, type FormsInput } from "./model";
import { renderForms } from "./render";

export interface FormsGalleryInput extends FormsInput { logicalSeconds: number }

/** Host time is accepted data; a control update samples and paints exactly once. */
export const galleryLive = defineInteractive<FormsGalleryInput>({
  size: { width: 1280, height: 720 },
  sample: { ...INITIAL_FORMS, logicalSeconds: 4.5 },
  guide: { id: "borrowed-shapes-gallery", steps: [
    { id: "forms", label: "Follow conserved material", duration: "30s", scene: { state: "forms" } },
  ] },
  render(ctx) {
    const snapshot = sampleForms(ctx.data, { seconds: ctx.data.logicalSeconds });
    ctx.scene.states({ forms: {} });
    ctx.scene.register({ id: "forms-observation", role: "material", label: "Conserved porcelain", metadata: observeForms(snapshot) });
    return renderForms(snapshot, { width: ctx.width, height: ctx.height, teaching: ctx.data.teaching, followGrains: ctx.data.followGrains, live: true });
  },
});
