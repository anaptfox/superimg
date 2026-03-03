import { TopNav } from '@/components/landing/TopNav'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <div className="mx-auto max-w-2xl px-6 py-16">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        {children}
      </article>
    </div>
    </>
  )
}
