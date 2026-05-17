import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "BSVgo CMS",
  description: "BSVgo 博客内容管理后台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
