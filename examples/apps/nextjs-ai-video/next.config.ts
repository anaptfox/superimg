import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["superimg-react"],
  serverExternalPackages: ["superimg", "esbuild", "esbuild-wasm"],
};

export default nextConfig;
