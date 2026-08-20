import type { Metadata, Viewport } from "next";
import "@repo/ui/globals.css";
import { ArchThemeProvider } from "@repo/theme/react";

export const metadata: Metadata = {
  title: "Arch Systems Overview",
  description: "Visual overview of the Arch Systems portal architecture",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="antialiased min-h-screen bg-bg-primary text-text-heading">
        <ArchThemeProvider>{children}</ArchThemeProvider>
      </body>
    </html>
  );
}
