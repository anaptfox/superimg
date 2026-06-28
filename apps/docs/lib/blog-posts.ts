export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  author: string;
  description: string;
  /** Suggested HN / social headline */
  distributionTitle: string;
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "introducing-superimg",
    title: "Introducing SuperImg",
    date: "2026-02-22",
    author: "SuperImg Team",
    description:
      "Programmatic media without a timeline editor. Write TypeScript that returns HTML — render to MP4, GIF, PNG, or SVG. Open source and LLM-friendly.",
    distributionTitle:
      "SuperImg – programmatic media as TypeScript functions (HTML in, MP4/GIF/PNG out)",
  },
];

export function getBlogPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}