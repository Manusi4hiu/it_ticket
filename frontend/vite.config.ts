import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = mode === "production" ? "/it_ticket/frontend/" : "/";

  return {
    base: basePath,
    plugins: [
      reactRouter(),
      tsconfigPaths(),
      VitePWA({
        strategies: "injectManifest", // custom SW — butuh push, notificationclick, & offline fallback
        base: basePath,
        registerType: "prompt", // staff klik refresh — safe buat form
        injectRegister: false, // manual register di root.tsx (kontrol penuh SSR)
        manifest: {
          id: basePath,
          name: "IT Aero Support",
          short_name: "IT Aero",
          description: "IT Support Ticketing System — PT Aero Nusantara Indonesia",
          theme_color: "#050b14",
          background_color: "#050b14",
          display: "standalone",
          orientation: "any",
          scope: basePath,
          start_url: basePath,
          categories: ["business", "productivity", "utilities"],
          icons: [
            { src: "icon-64.png", sizes: "64x64", type: "image/png" },
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            {
              name: "Buat Tiket Baru",
              short_name: "Buat Tiket",
              description: "Langsung buka form pengajuan tiket IT",
              url: `${basePath}submit-ticket`,
              icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Tiket Saya",
              short_name: "Tiket Saya",
              description: "Lihat antrean dan daftar tiket IT",
              url: `${basePath}tickets`,
              icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Dashboard",
              short_name: "Dashboard",
              description: "Buka ringkasan helpdesk dan status SLA",
              url: `${basePath}dashboard`,
              icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
            },
          ],
        },
        srcDir: "app",
        filename: "sw.ts",
        injectManifest: {
          // Ensure offline.html and PWA icons in public/ are included cleanly
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
        devOptions: { enabled: true, type: "module" },
      }),
    ],
    // Pre-bundle third-party deps used across lazy routes upfront so client navigation
    // (e.g. Dashboard -> Manual Ticket, Analytics, Settings) never hits Vite 504 "Outdated Optimize Dep".
    optimizeDeps: {
      include: [
        "@dazl/color-scheme/react",
        "@radix-ui/react-accordion",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-aspect-ratio",
        "@radix-ui/react-avatar",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-collapsible",
        "@radix-ui/react-context-menu",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-hover-card",
        "@radix-ui/react-label",
        "@radix-ui/react-menubar",
        "@radix-ui/react-navigation-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-progress",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-scroll-area",
        "@radix-ui/react-select",
        "@radix-ui/react-separator",
        "@radix-ui/react-slider",
        "@radix-ui/react-slot",
        "@radix-ui/react-switch",
        "@radix-ui/react-tabs",
        "@radix-ui/react-toast",
        "@radix-ui/react-toggle",
        "@radix-ui/react-toggle-group",
        "@radix-ui/react-tooltip",
        "classnames",
        "cmdk",
        "date-fns",
        "embla-carousel-react",
        "input-otp",
        "lucide-react",
        "react-hook-form",
        "react-resizable-panels",
        "recharts",
        "sonner",
        "uuid",
        "vaul",
        "zod",
      ],
    },
    server: {
      allowedHosts: ["it-ticket.ani.co.id"],
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/static": {
          target: env.VITE_PROXY_TARGET || "http://127.0.0.1:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
