import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render by default. The SuperImg <Player> is still mounted
  // client-only (see app/components/ClientOnly.tsx).
  ssr: true,
} satisfies Config;
