import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["superimg"],
  serverExternalPackages: ["esbuild", "esbuild-wasm"],
};

export default nextConfig;
