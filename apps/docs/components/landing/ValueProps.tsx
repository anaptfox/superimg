import { Check } from "lucide-react";

const VALUE_PROPS = [
  {
    title: "LLMs can write it",
    description:
      "Your render function is just HTML. Any LLM can write, debug, and iterate on it — no special training, no proprietary syntax.",
  },
  {
    title: "One template, 1,000 videos",
    description:
      "Pass a JSON array. Get a personalized video for each row. Same template, any volume.",
  },
  {
    title: "Hot reload at 60fps",
    description:
      "Save the file. See the video update instantly in your browser. No refresh, no rebuild.",
  },
  {
    title: "YouTube, Reels, TikTok — same code",
    description:
      "One template renders to any canvas size. Change dimensions, not your code.",
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
