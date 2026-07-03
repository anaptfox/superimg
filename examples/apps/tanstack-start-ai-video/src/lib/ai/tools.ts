import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

/** Server tool — pauses for user approval before "researching" the topic. */
export const enrichTopicDef = toolDefinition({
  name: "enrich_topic",
  description:
    "Research a topic and return key themes, eras, and a suggested accent color for the timeline",
  inputSchema: z.object({
    topic: z.string().meta({ description: "The timeline topic to research" }),
  }),
  outputSchema: z.object({
    themes: z.array(z.string()),
    era: z.string(),
    suggestedAccent: z.string(),
  }),
  needsApproval: true,
});

/** Client tool — previews accent color in the UI while the model works. */
export const previewAccentDef = toolDefinition({
  name: "preview_accent",
  description: "Preview an accent color in the UI before the timeline is finalized",
  inputSchema: z.object({
    color: z.string().meta({ description: "Hex color, e.g. #667eea" }),
    label: z.string().optional(),
  }),
  outputSchema: z.object({ applied: z.boolean() }),
});