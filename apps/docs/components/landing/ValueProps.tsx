import { Check } from "lucide-react";

const VALUE_PROPS = [
  {
    title: "Built for AI",
    description:
      "Write a render() function that returns HTML. Any LLM can write, debug, and iterate on that — no special training required.",
  },
  {
    title: "Batch render from data",
    description:
      "Pass a JSON array, get 1,000 personalized videos. One template, any volume.",
  },
  {
    title: "Live preview",
    description:
      "Save the file. The video updates in your browser — no refresh, no rebuild. Full 60fps.",
  },
  {
    title: "One template, every format",
    description:
      "YouTube, Reels, TikTok, Square — same code, different canvas dimensions.",
  },
];

export function ValueProps() {
  return (
    <section className="px-6 pb-16">
      <div className="mx-auto grid max-w-4xl gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <div key={prop.title} className="flex gap-3">
            <Check className="mt-1 h-5 w-5 shrink-0 text-green-500" />
            <div>
              <p className="font-semibold">{prop.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {prop.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
