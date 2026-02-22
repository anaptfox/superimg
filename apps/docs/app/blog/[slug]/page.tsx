import { notFound } from 'next/navigation'

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  try {
    const { default: Post } = await import(`@/content/blog/${slug}.mdx`)
    return <Post />
  } catch {
    notFound()
  }
}

export function generateStaticParams() {
  return [{ slug: 'introducing-superimg-react' }]
}

export const dynamicParams = false
