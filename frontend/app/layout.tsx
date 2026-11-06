import type React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "react-photo-view/dist/react-photo-view.css";
import { APP_DESC_CN, APP_DESC_EN, APP_NAME } from "@/lib/ui-text";
import { GlobalPreviewLayer } from "@/components/preview/GlobalPreviewLayer";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0d14",
};

export const metadata: Metadata = {
  title: `${APP_NAME}: ${APP_DESC_EN}`,
  description: APP_DESC_CN,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      {
        url: "/favicon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-type="software"
      data-radius="soft"
      data-buttons="solid"
      data-motion=""
      suppressHydrationWarning
    >
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PwaRegister />
          {children}
          <GlobalPreviewLayer />
          <Toaster
            position="top-center"
            richColors
            expand={true}
            visibleToasts={3}
            gap={12}
            pauseWhenPageIsHidden
            toastOptions={{
              duration: 3000,
              closeButton: true,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
