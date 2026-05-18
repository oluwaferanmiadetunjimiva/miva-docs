import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AuthorizationTag from "@/components/authorization_tag";
import { resolveDocsContext } from "@/lib/docsServiceContext";
import { getOpenApiOperationDetails, getOpenApiSpec } from "@/lib/openapiSpec";
import RequestBody from "./_components/request-body";
import Header from "./_components/header";
import RequestResponse from "./_components/request-responses";
import Playground from "./_components/playground";
import { PlaygroundBodyProvider } from "./_components/playground-body-context";

type PageProps = {
  params: Promise<{ slug: string; tag: string; method: string; path: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickEnvQuery(sp: Record<string, string | string[] | undefined>): string | undefined {
  const raw = sp.env;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { path, tag, method } = await params;
  const sp = await searchParams;
  const envQ = pickEnvQuery(sp);

  const [spec, details] = await Promise.all([
    getOpenApiSpec(envQ) as Promise<
      | {
          info?: { title?: string; description?: string };
        }
      | null
      | undefined
    >,
    getOpenApiOperationDetails(tag, method, path, envQ),
  ]);

  const baseTitle = spec?.info?.title ?? "Miva Docs";
  const summary = details.ok && typeof details.operation.summary === "string" ? details.operation.summary : undefined;

  const description = summary ?? spec?.info?.description ?? "Miva documentation";

  return {
    title: summary ?? baseTitle,
    description,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { tag, method, path } = await params;
  const sp = await searchParams;
  const envQ = pickEnvQuery(sp);

  const details = await getOpenApiOperationDetails(tag, method, path, envQ);
  if (!details.ok) notFound();

  const pathFromSpec = details.ok ? details.pathFromSpec : undefined;
  const operation = details.ok ? details.operation : undefined;
  const requires_auth = details.ok ? details.requires_auth : false;
  const schemas = details.ok ? details.schemas : undefined;

  const store = await cookies();
  const ctx = resolveDocsContext((name) => store.get(name)?.value, envQ);
  const apiBaseUrl = ctx.ok ? ctx.apiBaseUrl : (process.env.API_URL ?? "");
  const environments = ctx.ok ? ctx.environments.map((e) => ({ name: e.name })) : [];
  const activeEnvName = ctx.ok ? ctx.envName : "";

  const seedKey = operation?.operationId ?? `${method.toLowerCase()}:${pathFromSpec ?? path}`;

  return (
    <PlaygroundBodyProvider
      method={method}
      requestBody={operation?.requestBody}
      schemas={schemas}
      seedSalt={operation?.operationId}
    >
      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto border-r border-(--border) bg-(--surface)">
        <div className="pointer-events-none absolute inset-0 " />
        <div className="relative mx-auto w-full max-w-4xl space-y-16 px-8 py-16">
          <Header
            method={method}
            path={pathFromSpec}
            summary={operation?.summary}
            description={operation?.description}
          />

          {requires_auth && <AuthorizationTag />}

          <RequestBody request_body={operation?.requestBody} schemas={schemas} seedSalt={operation?.operationId} />

          <RequestResponse responses={operation?.responses} schemas={schemas} seedSalt={operation?.operationId} />
        </div>
      </main>

      <Suspense fallback={null}>
        <Playground
          seedKey={seedKey}
          method={method}
          path={pathFromSpec}
          apiBaseUrl={apiBaseUrl}
          parameters={operation?.parameters}
          environments={environments}
          activeEnvName={activeEnvName}
          serviceSlug={ctx.ok ? ctx.serviceSlug : ""}
        />
      </Suspense>
    </PlaygroundBodyProvider>
  );
}
