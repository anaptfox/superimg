import Link from 'next/link'

const posts = [
  {
    slug: 'introducing-superimg-react',
    title: 'Programmatic Video in React with SuperImg',
    date: '2026-02-22',
    description:
      'From a single <Player> tag to compile-preview-export in one hook. A walkthrough of the SuperImg React layer.',
  },
]

export default function BlogIndex() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold mb-2">Blog</h1>
      <p className="text-muted-foreground mb-12">
        Updates, guides, and news from the SuperImg team.
      </p>
      <ul className="space-y-8">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="group block">
              <time className="text-sm text-muted-foreground">{post.date}</time>
              <h2 className="text-lg font-medium mt-1 group-hover:underline underline-offset-4">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {post.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
