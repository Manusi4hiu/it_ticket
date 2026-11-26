import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useEffect } from "react";

import type { Route } from "./+types/root";
import { Toaster } from "./components/ui/toaster/toaster";
import colorSchemeApi from "@dazl/color-scheme/client?url";
import { setupPWAUpdatePrompt } from "./components/reload-prompt";
import { PwaDownloadBanner } from "./components/pwa-install-prompt";
import { NetworkStatusBanner } from "./components/network-status-banner";
import { captureInstallPrompt } from "./hooks/use-pwa-install";
import { getBaseUrl, publicAsset } from "./utils/asset";

import "./styles/reset.css";
import "./styles/global.css";
import "./styles/tokens/keyframes.css";
import "./styles/tokens/animations.css";
import "./styles/tokens/colors.css";
import "./styles/tokens/decorations.css";
import "./styles/tokens/spacings.css";
import "./styles/tokens/typography.css";
import "./styles/theme.css";
import { useColorScheme } from "@dazl/color-scheme/react";
import favicon from "/favicon.svg";

const BASE_URL = getBaseUrl();

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "icon",
    href: favicon,
    type: "image/svg+xml",
  },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: publicAsset("apple-touch-icon.png"),
  },
  {
    rel: "manifest",
    href: publicAsset("manifest.webmanifest"),
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { rootCssClass, resolvedScheme } = useColorScheme();
  return (
    <html lang="en" suppressHydrationWarning className={rootCssClass} style={{ colorScheme: resolvedScheme }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta />
        <title>IT Aero Nusantara - IT Support Ticketing System</title>
        <meta name="theme-color" content="#050b14" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="IT Aero" />
        <script src={colorSchemeApi}></script>
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Register PWA service worker, install prompt capture, and update prompt (client-side only)
  useEffect(() => {
    if (import.meta.env.SSR) return;
    captureInstallPrompt();

    if ("serviceWorker" in navigator) {
      const swUrl = import.meta.env.DEV ? `${BASE_URL}dev-sw.js?dev-sw` : `${BASE_URL}sw.js`;
      navigator.serviceWorker
        .register(swUrl, {
          scope: BASE_URL,
          ...(import.meta.env.DEV ? { type: "module" as const } : {}),
        })
        .then(() => setupPWAUpdatePrompt())
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn("[PWA] Service Worker registration failed:", err);
          }
        });
    }
  }, []);

  return (
    <>
      <NetworkStatusBanner />
      <Outlet />
      <PwaDownloadBanner />
    </>
  );
}

import { ErrorView } from "./components/error-view";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "An unexpected error occurred.";
  let code: string | number = "Error";
  let type: "unauthorized" | "not-found" | "error" = "error";
  let title = "Oops! Something went wrong";
  let isNetworkError = typeof navigator !== "undefined" && navigator.onLine === false;

  if (isRouteErrorResponse(error)) {
    code = error.status;
    if (error.status === 404) {
      type = "not-found";
      title = "Page Not Found";
      message = "The requested page could not be found.";
    } else if (error.status === 401) {
      type = "unauthorized";
      title = "Unauthorized Access";
      message = "You need to be logged in to access this page.";
    } else {
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(error.message)) {
      isNetworkError = true;
    }
  }

  if (isNetworkError) {
    code = "Offline";
    title = "Koneksi Terputus";
    message = "Tidak dapat terhubung ke server. Periksa Wi-Fi atau data seluler Anda lalu coba muat ulang.";
  }

  return (
    <Layout>
      <ErrorView
        code={code}
        title={title}
        message={message}
        type={type}
        actionLabel={isNetworkError ? "Coba Lagi" : undefined}
        onAction={isNetworkError ? () => window.location.reload() : undefined}
      />
    </Layout>
  );
}
