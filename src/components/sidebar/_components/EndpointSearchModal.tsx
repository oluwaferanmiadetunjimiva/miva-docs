"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withEnvQuery } from "@/lib/docsNav";
import { Search } from "lucide-react";
import { Method } from "@/components/badges";
import { buildDocsOperationRoute, getPrimaryOpenApiTag } from "@/lib/helpers";

type Operation = {
  url: string;
  method: string;
  operationId: string;
  tags: string[];
  summary?: string;
  description?: string;
};

type Props = {
  operations: Operation[];
};

function normalizeText(v: string): string {
  return v.toLowerCase();
}

function tokenizeQuery(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function primaryTag(tags: string[] | undefined): string {
  return getPrimaryOpenApiTag(tags);
}

function buildRoute(serviceSlug: string, op: Operation): string {
  return buildDocsOperationRoute({
    serviceSlug,
    tag: primaryTag(op.tags),
    method: op.method,
    operationId: op.operationId,
  });
}

function snippet(text: string | undefined, max = 140): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function EndpointSearchModal({ operations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const env = searchParams.get("env")?.trim() ?? "";
  const serviceSlug = pathname.split("/").filter(Boolean)[0] ?? "";
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  const results = useMemo(() => {
    const tokens = tokenizeQuery(debouncedQuery);
    if (tokens.length === 0) return [];

    const scored = operations
      .map((op) => {
        const url = op.url ?? "";
        const operationId = op.operationId ?? "";
        const summary = op.summary ?? "";
        const description = op.description ?? "";
        const tag = primaryTag(op.tags);
        const method = op.method ?? "";

        const haystack = normalizeText(`${url} ${operationId} ${summary} ${description}`);
        const keep = tokens.every((t) => haystack.includes(t));
        if (!keep) return null;

        const q = normalizeText(debouncedQuery.trim());
        const urlN = normalizeText(url);
        const opIdN = normalizeText(operationId);
        const summaryN = normalizeText(summary);
        const descN = normalizeText(description);

        let score = 0;
        if (q && urlN.includes(q)) score += 10;
        if (q && opIdN.includes(q)) score += 8;
        if (q && summaryN.includes(q)) score += 4;
        if (q && descN.includes(q)) score += 2;
        score += Math.max(0, 6 - Math.min(url.length, 120) / 20); // slight preference for shorter URLs

        return { op: { ...op, method, tag }, score, route: buildRoute(serviceSlug, op) };
      })
      .filter(Boolean) as { op: Operation & { tag: string }; score: number; route: string }[];

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.op.url !== b.op.url) return a.op.url.localeCompare(b.op.url);
      return a.op.operationId.localeCompare(b.op.operationId);
    });

    return scored.slice(0, 20);
  }, [debouncedQuery, operations, serviceSlug]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setHighlightIndex(0);
  };

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <>
      <div className="p-3 pb-2">
        <div className="relative">
          <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-(--text-subtle)">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search endpoints..."
            value=""
            readOnly
            onMouseDown={(e) => {
              e.preventDefault();
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full cursor-text rounded-md border border-(--border) bg-(--surface) py-1.5 pr-3 pl-8 text-xs text-(--text) transition-shadow placeholder:text-(--text-subtle) focus:border-(--border-focus) focus:ring-1 focus:ring-(--ring) focus:outline-none"
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Endpoint search modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-(--border) bg-(--surface) shadow-2xl">
            <div className="border-b border-(--border) bg-(--surface-2) px-6 py-4">
              <div className="text-sm font-semibold text-(--text)">Search endpoints</div>
              <div className="mt-1 text-xs text-(--text-muted)">Type to filter by URL, operation, summary, or description.</div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold tracking-wider text-(--text-muted) uppercase">Query</label>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                      return;
                    }

                    if (!hasQuery) return;

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (results.length === 0) return;
                      setHighlightIndex((i) => (i + 1) % results.length);
                      return;
                    }

                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (results.length === 0) return;
                      setHighlightIndex((i) => (i - 1 + results.length) % results.length);
                      return;
                    }

                    if (e.key === "Enter") {
                      e.preventDefault();
                      const pick = results[highlightIndex];
                      if (!pick) return;
                      router.push(withEnvQuery(pick.route, env));
                      close();
                    }
                  }}
                  placeholder="e.g. users create profile"
                  className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2.5 text-sm text-(--text) shadow-sm transition-all placeholder:text-(--text-subtle) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              {hasQuery && (
                <div className="max-h-[55vh] overflow-auto rounded-xl border border-(--border) bg-(--bg) shadow-inner">
                  {results.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-(--text-muted)">No matches.</div>
                  ) : (
                    <ul className="divide-y divide-(--border)">
                      {results.map((r, idx) => {
                        const tag = primaryTag(r.op.tags);
                        const isActive = idx === highlightIndex;
                        const title = (r.op.summary ?? "").trim() || r.op.url;
                        const desc = snippet(r.op.description, 160);

                        return (
                          <li key={`${r.op.method}:${r.op.url}:${r.op.operationId}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setHighlightIndex(idx)}
                              onClick={() => {
                                router.push(withEnvQuery(r.route, env));
                                close();
                              }}
                              className={
                                isActive
                                  ? "w-full bg-(--surface) px-4 py-3 text-left"
                                  : "w-full px-4 py-3 text-left transition-colors hover:bg-(--surface-2)"
                              }
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-(--text)">{title}</div>
                                  <div className="mt-1 flex items-center gap-2 text-xs text-(--text-muted)">
                                    <Method method={r.op.method} />
                                    <span className="truncate font-mono">{r.op.url}</span>
                                    <span className="shrink-0 rounded border border-(--border) bg-(--surface-2) px-2 py-0.5 font-mono text-[10px] text-(--text-muted)">
                                      {tag}
                                    </span>
                                  </div>
                                  {desc && <div className="mt-2 line-clamp-2 text-xs text-(--text-muted)">{desc}</div>}
                                </div>
                                <div className="shrink-0 pt-0.5 text-[11px] font-semibold text-(--text-subtle)">
                                  Enter
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  className="rounded-lg border border-(--border) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--text-muted) transition-colors hover:bg-(--surface-hover)"
                  onClick={close}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

