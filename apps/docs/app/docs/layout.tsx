import { DocsSidebar } from './sidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl">
      <DocsSidebar />
      <main className="min-w-0 flex-1 px-8 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {children}
        </article>
      </main>
    </div>
  )
}
