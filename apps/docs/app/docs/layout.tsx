import { DocsSidebar } from './sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DocsSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">Docs</span>
        </header>
        <main className="mx-auto max-w-4xl px-8 py-16">
          <article className="prose prose-neutral dark:prose-invert max-w-none">
            {children}
          </article>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
