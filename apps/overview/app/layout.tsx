import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arch Systems Overview",
  description: "Visual overview of the Arch Systems portal architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0f0f0f]">{children}</body>
    </html>
  );
}
