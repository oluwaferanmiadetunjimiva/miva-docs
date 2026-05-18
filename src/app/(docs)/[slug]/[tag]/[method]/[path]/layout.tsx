import type { ReactNode } from "react";
import "@/styles/globals.css";

export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <>{children}</>;
}
