import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { firaCode } from "@/lib/fonts";
import type { ReactNode } from "react";


import "@/styles/globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en" className={`${firaCode.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
