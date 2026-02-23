import { Terminal, MessageSquare, Video } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Install the skill",
    description: "Add SuperImg to your AI coding assistant with a single command",
    icon: Terminal,
    color: "text-blue-400",
  },
  {
    number: "2",
    title: "Describe your video",
    description: "Tell your AI what you want: \"Create a countdown timer\" or \"Make a text animation\"",
    icon: MessageSquare,
    color: "text-purple-400",
  },
  {
    number: "3",
    title: "Preview and export",
    description: "AI generates the code, you see the result instantly, export when ready",
    icon: Video,
    color: "text-green-400",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border/50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Three steps to AI-generated videos
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
                <step.icon className={`h-6 w-6 ${step.color}`} />
              </div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Step {step.number}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
