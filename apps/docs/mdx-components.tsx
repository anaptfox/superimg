import type { MDXComponents } from 'mdx/types'
import { PlayerDemo } from '@/components/blog/PlayerDemo'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    PlayerDemo,
  }
}
