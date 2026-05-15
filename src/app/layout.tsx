import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "BSVgo CMS",
  description: "Administration console for BSVgo blog content"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
