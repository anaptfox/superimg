import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!getBlogPost(slug)) {
    notFound();
  }

  try {
    const { default: Post } = await import(`@/content/blog/${slug}.mdx`);
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <Post />
        </article>
      </div>
    );
  } catch {
    notFound();
  }
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}