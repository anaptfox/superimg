import createMDX from '@next/mdx'

const baseURL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : 'https://' +
      (process.env.VERCEL_ENV === 'production'
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL)

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  serverExternalPackages: ['superimg', 'esbuild', 'esbuild-wasm'],
  assetPrefix: baseURL,
}

const withMDX = createMDX({
  options: {
    remarkPlugins: [['remark-gfm']],
    rehypePlugins: [
      ['rehype-pretty-code', { theme: 'one-dark-pro', keepBackground: true }],
    ],
  },
})

export default withMDX(nextConfig)
