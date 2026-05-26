import type { Metadata } from "next";
import { inter, jetbrainsMono } from "@/lib/fonts";
import type { ReactNode } from "react";

import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Miva Docs",
    description: "Miva documentation",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
