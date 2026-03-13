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
      { title: 'How It Works', slug: 'how-it-works' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Animation Basics', slug: 'animation' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { title: 'CLI', slug: 'cli' },
      { title: 'Player', slug: 'player' },
    ],
  },
]

export function getAllDocSlugs(): string[][] {
  return docsNav.flatMap((section) =>
    section.items.map((item) => item.slug.split('/'))
  )
}
