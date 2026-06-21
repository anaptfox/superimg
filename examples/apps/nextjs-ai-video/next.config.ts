import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["superimg"],
  // rolldown and @rolldown/browser use node: protocol imports that crash Turbopack's
  // Rust NFT tracer (open bug). Mark them external so webpack won't bundle them.
  serverExternalPackages: ["rolldown", "@rolldown/browser"],
};

export default nextConfig;
