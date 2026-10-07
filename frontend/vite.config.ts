import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: mode === "production" ? "/it_ticket/frontend/" : "/",
    plugins: [
      reactRouter(),
      tsconfigPaths(),
      VitePWA({
        strategies: "injectManifest", // custom SW — butuh push + notificationclick handlers
        base: mode === "production" ? "/it_ticket/frontend/" : "/",
        registerType: "prompt", // staff klik refresh — safe buat form
        injectRegister: false, // manual register di root.tsx (kontrol penuh)
        manifest: {
          name: "IT Aero Support",
          short_name: "IT Aero",
          description: "IT Support Ticketing System",
          theme_color: "#050b14",
          background_color: "#050b14",
          display: "standalone",
          scope: mode === "production" ? "/it_ticket/frontend/" : "/",
          start_url: mode === "production" ? "/it_ticket/frontend/" : "/",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          apple_touch_icon: "apple-touch-icon.png",
        },
        srcDir: "app",
        filename: "sw.ts",
        devOptions: { enabled: true, type: "module" },
      }),
    ],
    server: {
      allowedHosts: ["it-ticket.ani.co.id"],
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://127.0.0.1:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
