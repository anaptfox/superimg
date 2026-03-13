import { Star } from "lucide-react";

async function getStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/anaptfox/superimg", {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.stargazers_count ?? null;
  } catch {
    return null;
  }
}

function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return count.toString();
}

export async function GitHubStars() {
  const stars = await getStars();

  return (
    <a
      href="https://github.com/anaptfox/superimg"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-4 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
        {stars !== null ? formatStars(stars) : "Star"}
      </span>
      <span className="border-l border-border/50 pl-4">Open Source</span>
      <span className="border-l border-border/50 pl-4">MIT License</span>
    </a>
  );
}
