import { z } from "zod";

export const TimelineEventSchema = z.object({
  date: z.string().meta({ description: "Year or short date label, e.g. '2015'" }),
  title: z.string().meta({ description: "2-6 word headline for the event" }),
  description: z.string().meta({ description: "One factual sentence, max 15 words" }),
});

export const TimelineSchema = z.object({
  title: z
    .string()
    .meta({ description: "A concise 3-6 word title for the timeline" }),
  events: z
    .array(TimelineEventSchema)
    .min(5)
    .max(8)
    .meta({ description: "5 to 8 events in chronological order" }),
  accentColor: z
    .string()
    .meta({ description: "Vibrant hex color visible on dark backgrounds" }),
});

export type TimelineData = z.infer<typeof TimelineSchema>;

export const ProviderSchema = z.enum(["ollama", "openai"]);
export type ProviderId = z.infer<typeof ProviderSchema>;

export interface ChatForwardedProps {
  provider?: ProviderId;
  model?: string;
}