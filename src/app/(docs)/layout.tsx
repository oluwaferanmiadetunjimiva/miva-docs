import type { Metadata } from "next";
import { getOpenApiSpec } from "@/lib/openapiSpec";
import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import { Toaster } from "react-hot-toast";
import { TokenProvider } from "@/components/token-provider";
import { cookies } from "next/headers";
import { resolveDocsContext } from "@/lib/docsServiceContext";
import { getScopedTokenFromCookies } from "@/lib/token";

import "@/styles/globals.css";


export async function generateMetadata(): Promise<Metadata> {
  const spec = (await getOpenApiSpec()) as { info?: { title?: string; description?: string } } | null | undefined;

  const title = spec?.info?.title ?? "Miva Docs";
  const description = spec?.info?.description ?? "Miva documentation";

  return {
    title,
    description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const store = await cookies();
  const ctx = resolveDocsContext((name) => store.get(name)?.value);
  const serviceSlug = ctx.ok ? ctx.serviceSlug : undefined;
  const envName = ctx.ok ? ctx.envName : undefined;
  const token =
    ctx.ok ? await getScopedTokenFromCookies({ serviceSlug: ctx.serviceSlug, envName: ctx.envName }) : undefined;

  return (

    <div className="flex h-screen w-full overflow-hidden text-sm text-(--text) antialiased selection:bg-gray-200">
      <TokenProvider initialToken={token} serviceSlug={serviceSlug} envName={envName}>
        <Sidebar />
        {children}
        <Toaster />
      </TokenProvider>
    </div>

  );
}
