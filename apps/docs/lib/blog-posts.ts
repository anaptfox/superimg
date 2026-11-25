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
      "Write a media program once — play it live in your app, export to video, GIF, still, or SVG. Open source and LLM-friendly.",
    distributionTitle:
      "SuperImg – TypeScript media programs that play live and export anywhere",
  },
];

export function getBlogPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}