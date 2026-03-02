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
    title: 'Overview',
    items: [
      { title: 'Introduction', slug: 'introduction' },
      { title: 'Getting Started', slug: 'getting-started' },
    ],
  },
]

export function getAllDocSlugs(): string[][] {
  return docsNav.flatMap((section) =>
    section.items.map((item) => item.slug.split('/'))
  )
}
