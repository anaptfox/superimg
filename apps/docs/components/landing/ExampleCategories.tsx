import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EXAMPLE_CATEGORIES, getExamplesByCategory } from "@/lib/video/examples";

export function ExampleCategories() {
  return (
    <section className="border-t border-border/50 px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready-to-use templates
        </h2>
        <p className="mt-4 text-muted-foreground">
          Jump-start your project with curated examples across different use
          cases
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {EXAMPLE_CATEGORIES.map((category) => {
            const examples = getExamplesByCategory(category.id);
            const firstExample = examples[0];
            return (
              <Link
                key={category.id}
                href={`/editor?example=${firstExample?.id || ""}`}
              >
                <Badge
                  variant="secondary"
                  className="cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {category.title}
                  <span className="ml-2 text-xs opacity-60">
                    {examples.length}
                  </span>
                </Badge>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          {EXAMPLE_CATEGORIES.reduce(
            (acc, cat) => acc + getExamplesByCategory(cat.id).length,
            0
          )}{" "}
          templates across {EXAMPLE_CATEGORIES.length} categories
        </p>
      </div>
    </section>
  );
}
