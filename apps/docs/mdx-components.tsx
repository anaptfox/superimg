import type { MDXComponents } from 'mdx/types'
import { PlayerDemo } from '@/components/demos/PlayerDemo'
import { CodeDemo } from '@/components/demos/CodeDemo'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    PlayerDemo,
    CodeDemo,
  }
}
