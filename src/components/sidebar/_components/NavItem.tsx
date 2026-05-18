"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withEnvQuery } from "@/lib/docsNav";
import { buildDocsOperationRoute, getPrimaryOpenApiTag } from "@/lib/helpers";
import { Method } from "@/components/badges";

type Props = {
  url: string;
  method: string;
  operationId: string;
  tags: string[];
};

export default function NavItem({ method, operationId, url, tags }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const env = searchParams.get("env")?.trim() ?? "";
  const serviceSlug = pathname.split("/").filter(Boolean)[0] ?? "";
  const route = buildDocsOperationRoute({
    serviceSlug,
    tag: getPrimaryOpenApiTag(tags),
    method,
    operationId,
  });
  const href = withEnvQuery(route, env);
  const isActive = pathname === route;

  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={
          isActive
            ? "flex items-center gap-3 rounded-lg border border-(--border) bg-(--surface) px-2 py-2 text-(--text) shadow-sm ring-1 ring-(--surface-3) transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md"
            : "group flex items-center gap-3 rounded-lg px-2 py-2 text-(--text-muted) transition-all duration-200 ease-out hover:-translate-y-px hover:bg-(--surface-hover) hover:text-(--text) hover:shadow-sm"
        }
      >
        <Method method={method} />
        <span className="truncate font-mono text-xs">{url}</span>
      </Link>
    </li>
  );
}
