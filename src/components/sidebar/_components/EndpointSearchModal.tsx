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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setHighlightIndex(0);
  };

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <>
      <div className="px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-(--border) bg-(--surface) py-1.5 pr-2 pl-2.5 text-left text-[12.5px] text-(--text-subtle) shadow-[var(--shadow-xs)] transition-all duration-150 hover:bg-(--surface-hover-2) hover:text-(--text-muted) focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) focus:outline-none"
          aria-label="Search endpoints"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search endpoints</span>
          <kbd className="rounded border border-(--border) bg-(--surface-2) px-1.5 py-0.5 font-mono text-[10px] text-(--text-subtle)">
            ⌘K
          </kbd>
        </button>
      </div>

      {isOpen && (
        <div
          className="md-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Endpoint search modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="md-scale-in w-full max-w-2xl overflow-hidden rounded-2xl border border-(--border) bg-(--surface) shadow-[var(--shadow-pop)]">
            <div className="flex items-center gap-3 border-b border-(--border) px-5 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-(--text-subtle)" />
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
                placeholder="Search endpoints by URL, operation, summary…"
                className="flex-1 bg-transparent text-[15px] text-(--text) placeholder:text-(--text-subtle) focus:outline-none"
                autoFocus
              />
              <kbd className="rounded-md border border-(--border) bg-(--surface-2) px-1.5 py-0.5 font-mono text-[10px] text-(--text-subtle)">
                Esc
              </kbd>
            </div>

            {hasQuery && (
              <div className="max-h-[55vh] overflow-auto">
                {results.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-(--text-muted)">No matches.</div>
                ) : (
                  <ul className="py-1">
                    {results.map((r, idx) => {
                      const tag = primaryTag(r.op.tags);
                      const isActive = idx === highlightIndex;
                      const title = (r.op.summary ?? "").trim() || r.op.url;
                      const desc = snippet(r.op.description, 140);

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
                                ? "w-full bg-(--accent-soft) px-5 py-2.5 text-left transition-colors"
                                : "w-full px-5 py-2.5 text-left transition-colors hover:bg-(--surface-hover-2)"
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Method method={r.op.method} />
                                  <span className="truncate text-[13.5px] font-medium text-(--text)">{title}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[12px] text-(--text-muted)">
                                  <span className="truncate font-mono">{r.op.url}</span>
                                  <span className="shrink-0 rounded-md bg-(--surface-3) px-1.5 py-0.5 font-mono text-[10px] text-(--text-subtle) ring-1 ring-inset ring-(--border)">
                                    {tag}
                                  </span>
                                </div>
                                {desc && <div className="mt-1 line-clamp-1 text-[12px] text-(--text-subtle)">{desc}</div>}
                              </div>
                              {isActive && (
                                <div className="shrink-0 pt-0.5 text-[11px] font-medium text-(--accent)">↵</div>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-(--border) bg-(--surface-2)/60 px-5 py-2.5 text-[11px] text-(--text-subtle)">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-(--border) bg-(--surface) px-1.5 py-0.5 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-(--border) bg-(--surface) px-1.5 py-0.5 font-mono">↵</kbd>
                  Open
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-0.5 text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text)"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

