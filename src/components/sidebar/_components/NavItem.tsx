"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withEnvQuery } from "@/lib/docsNav";
import { buildDocsOperationRoute, getPrimaryOpenApiTag } from "@/lib/helpers";
import { Method } from "@/components/badges";
import { cn } from "@/lib/cn";

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
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-200 ease-[var(--ease-apple)]",
          isActive
            ? "bg-(--surface) text-(--text) shadow-[var(--shadow-sm)] ring-1 ring-(--border)"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text)",
        )}
      >
        <Method method={method} className="shrink-0" />
        <span className="truncate font-mono text-[12px] tracking-tight">{url}</span>
      </Link>
    </li>
  );
}
