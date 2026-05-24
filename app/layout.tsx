import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { validateEnv } from "@/lib/env-validation";

// Validate environment variables on startup
validateEnv();
import { ToastProvider } from "@/components/ui/toast";
import { SkipLink } from "@/components/ui/skip-link";
import { AuthProvider } from "@/components/auth-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { PWAInstallPrompt } from "@/components/pwa/install-prompt";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Atlas Helpdesk",
  description: "Modern helpdesk and customer support platform",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased bg-white text-gray-900`}
      >
        <SkipLink />
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <main id="main-content" className="outline-none">
                {children}
              </main>
              <ServiceWorkerRegister />
              <PWAInstallPrompt />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
