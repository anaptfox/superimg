import { generateText, Output } from "ai";
import { ollama } from "ai-sdk-ollama";
import { z } from "zod";

const TimelineSchema = z.object({
  title: z
    .string()
    .describe("A concise 3-6 word title for the timeline, e.g. 'History of JavaScript'"),
  events: z
    .array(
      z.object({
        date: z.string().describe("Year or short date label, e.g. '2015' or 'March 2020'"),
        title: z.string().describe("2-6 word headline for the event"),
        description: z.string().describe("One factual sentence, max 15 words"),
      })
    )
    .min(5)
    .max(8)
    .describe("5 to 8 events in chronological order"),
  accentColor: z
    .string()
    .describe("A vibrant hex color that fits the topic mood, visible on dark backgrounds"),
});

export async function POST(req: Request) {
  const { topic } = await req.json();

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return Response.json({ error: "topic is required" }, { status: 400 });
  }

  // Ollama runs locally — no API key needed.
  // Override OLLAMA_BASE_URL or OLLAMA_MODEL in .env.local as needed.
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const { output } = await generateText({
    model: ollama(model),
    output: Output.object({ schema: TimelineSchema }),
    prompt: `Create an accurate, chronological timeline about: "${topic.trim()}"

Return 5-8 key events in order. Each event must have a real date, a short title, and one factual sentence.
Pick a hex accent color that fits the emotional tone of the topic.`,
  });

  return Response.json(output);
}
