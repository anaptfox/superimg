import { notFound } from 'next/navigation'
import { getAllDocSlugs } from '@/lib/docs-nav'

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const path = slug.join('/')

  try {
    const { default: Content } = await import(`@/content/docs/${path}.mdx`)
    return <Content />
  } catch {
    notFound()
  }
}

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false
