import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  basename: process.env.NODE_ENV === "production" ? "/it_ticket/frontend/" : "/",
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
