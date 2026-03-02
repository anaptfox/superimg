import type { MDXComponents } from 'mdx/types'
import { PlayerDemo } from '@/components/blog/PlayerDemo'
import { CodeDemo } from '@/components/blog/CodeDemo'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    PlayerDemo,
    CodeDemo,
  }
}
