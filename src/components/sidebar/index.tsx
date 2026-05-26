import { Suspense } from "react";
import { getOpenApiSpec, getOpenApiSpecMeta } from "@/lib/openapiSpec";
import { getPrimaryOpenApiTag, slugifyOpenApiTag } from "@/lib/helpers";
import NavItem from "@/components/sidebar/_components/NavItem";
import SidebarSection from "@/components/sidebar/_components/SidebarSection";
import EndpointSearchModal from "./_components/EndpointSearchModal";
import Link from "next/link";
import ServiceSelect from "./_components/ServiceSelect";
import { cookies } from "next/headers";
import ServiceStatus from "./_components/ServiceStatus";

type OpenApiTag = {
  name: string;
};

type OpenApiOperation = {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
};

type OpenApiSpec = {
  info?: { title?: string; description?: string };
  tags?: OpenApiTag[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

function titleCaseTagName(name: string): string {
  const parts = name
    .split(/[-_]+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return name;

  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function deriveTagNameFromOperation(op: { tags?: string[] }): string {
  return getPrimaryOpenApiTag(op.tags);
}

export default async function Sidebar() {
  const spec = (await getOpenApiSpec()) as OpenApiSpec | null | undefined;
  const meta = await getOpenApiSpecMeta();
  const cookieStore = await cookies();
  const initialSlug = cookieStore.get("docs_service_slug")?.value ?? null;

  const supportedMethods = new Set(["get", "post", "put", "patch", "delete"]);

  const operations = Object.entries(spec?.paths ?? {}).flatMap(([url, pathItem]) => {
    return Object.entries(pathItem ?? {}).flatMap(([method, operation]) => {
      const normalizedMethod = method.toLowerCase();
      if (!supportedMethods.has(normalizedMethod)) return [];
      if (!operation?.operationId) return [];

      return [
        {
          url,
          method: normalizedMethod,
          operationId: operation.operationId,
          tags: operation.tags ?? [],
          summary: operation.summary,
          description: operation.description,
        },
      ];
    });
  });

  const specTags = (spec?.tags ?? [])
    .map((t) => t.name.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  const hasSpecTags = specTags.length > 0;

  const operationTagSet = new Set<string>();
  for (const op of operations) operationTagSet.add(deriveTagNameFromOperation(op));

  const tags = hasSpecTags
    ? [
        ...specTags,
        ...(operationTagSet.has("default") && !specTags.some((t) => slugifyOpenApiTag(t.name) === "default")
          ? [{ name: "default" }]
          : []),
      ]
    : Array.from(operationTagSet).map((name) => ({ name }));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-(--border) bg-(--surface-2)/80 backdrop-blur-xl lg:flex">
      <Link href="/" className="group">
        <div className="flex h-14 items-center gap-2.5 border-b border-(--border) px-5 transition-colors duration-200 group-hover:bg-(--surface-hover-2)">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Miva" className="h-7 w-auto object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-(--text)">Miva Docs</span>
        </div>
      </Link>

      <div className="space-y-3 border-b border-(--border) px-4 py-4">
        <ServiceSelect initialSlug={initialSlug} />
        <Suspense fallback={null}>
          <ServiceStatus lastModified={meta.lastModified} apiVersion={meta.version} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <EndpointSearchModal operations={operations} />
      </Suspense>

      <Suspense fallback={<nav className="flex-1 overflow-y-auto px-3 py-4" aria-hidden />}>
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-4">
          {tags.map((tag) => {
            const tagSlug = slugifyOpenApiTag(tag.name);
            const tagOperations = operations.filter(
              (op) => slugifyOpenApiTag(deriveTagNameFromOperation(op)) === tagSlug,
            );

            if (tagOperations.length === 0) return null;

            return (
              <SidebarSection
                key={tag.name}
                title={titleCaseTagName(tag.name)}
                tagSlug={tagSlug}
              >
                {tagOperations.map((op) => (
                  <NavItem
                    key={`${op.method}:${op.url}:${op.operationId}`}
                    method={op.method}
                    operationId={op.operationId}
                    tags={op.tags}
                    url={op.url}
                  />
                ))}
              </SidebarSection>
            );
          })}
        </nav>
      </Suspense>
    </aside>
  );
}
