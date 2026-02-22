export interface NavItem {
  title: string
  slug: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const docsNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', slug: 'getting-started' },
    ],
  },
]

export function getAllDocSlugs(): string[][] {
  return docsNav.flatMap((section) =>
    section.items.map((item) => item.slug.split('/'))
  )
}
