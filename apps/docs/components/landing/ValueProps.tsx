import { Check } from "lucide-react";

const VALUE_PROPS = [
  {
    title: "Write once — play live, export anywhere",
    description:
      "One media program embeds in your product and exports as video, image, GIF, or SVG.",
  },
  {
    title: "Pure function of time",
    description:
      "render(ctx) is deterministic. Preview and export stay aligned; agents can check without opening videos.",
  },
  {
    title: "Built for agents",
    description:
      "Skill install, check, inspect, and export form a loop LLMs can run. Plain TypeScript, not a mystery timeline.",
  },
  {
    title: "Batch from real data",
    description:
      "Collections run one media program across episodes, products, cards, or personalized clips.",
  },
  {
    title: "Responsive by design",
    description:
      "Root content reflows to custom sizes, while editions handle the aspect ratios that need distinct art direction.",
  },
  {
    title: "MIT for product embeds",
    description:
      "Ship in SaaS and CI without a company license tax. Keep the media program in git next to your app.",
  },
];

export function ValueProps() {
  return (
    <section className="border-t border-border/50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Why teams pick SuperImg
          </h2>
          <p className="mt-2 text-muted-foreground">
            Not export-only tooling — media programs you keep in git, play in product, and ship to destinations.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.title} className="flex gap-3">
              <Check className="mt-1 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="font-semibold">{prop.title}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {prop.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
