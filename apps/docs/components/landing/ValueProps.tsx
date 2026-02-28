import { Check } from "lucide-react";

const VALUE_PROPS = [
  {
    title: "Just HTML & CSS",
    description:
      "No framework to learn. If you can build a web page, you can make a video.",
  },
  {
    title: "Live preview",
    description:
      "Edit code, see the video update at 60fps in your browser.",
  },
  {
    title: "One template, every format",
    description:
      "YouTube, Reels, TikTok, Square — same code, different dimensions.",
  },
  {
    title: "Batch render from data",
    description:
      "Pass a JSON file, get 1,000 personalized videos from one template.",
  },
  {
    title: "Built for AI",
    description:
      "Templates are pure functions returning HTML. The simplest format for AI to write, debug, and iterate on.",
  },
  {
    title: "One command to MP4",
    description:
      "npx superimg render template.ts -o video.mp4 — no accounts, no cloud.",
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
