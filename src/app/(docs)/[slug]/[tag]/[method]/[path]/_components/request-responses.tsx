"use client";

import { prettyPayload, copyToClipboard } from "@/lib/helpers";
import { generateExampleFromSchema } from "@/lib/generateExampleFromSchema";
import { Copy } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  responses?: Record<string, unknown>;
  schemas?: Record<string, unknown>;
  seedSalt?: string;
};

type ParsedResponse = {
  status: string;
  description: string;
  contentType?: string;
  schema?: Record<string, unknown>;
};

function isNumericStatus(s: string): boolean {
  return /^[0-9]{3}$/.test(s);
}

function sortResponseKeys(keys: string[]): string[] {
  const numeric = keys.filter(isNumericStatus).sort((a, b) => Number(a) - Number(b));
  const other = keys.filter((k) => !isNumericStatus(k) && k !== "default").sort();
  const hasDefault = keys.includes("default");
  return hasDefault ? [...numeric, ...other, "default"] : [...numeric, ...other];
}

function pickContentType(content: unknown): { contentType?: string; media?: Record<string, unknown> } {
  if (!content || typeof content !== "object") return {};
  const record = content as Record<string, unknown>;
  if (record["application/json"] && typeof record["application/json"] === "object") {
    return { contentType: "application/json", media: record["application/json"] as Record<string, unknown> };
  }
  const first = Object.keys(record)[0];
  if (!first) return {};
  const media = record[first];
  if (!media || typeof media !== "object") return { contentType: first };
  return { contentType: first, media: media as Record<string, unknown> };
}

export default function RequestResponse({ responses, schemas, seedSalt }: Props) {
  const parsed = useMemo<ParsedResponse[]>(() => {
    if (!responses || typeof responses !== "object") return [];
    const record = responses as Record<string, unknown>;
    const keys = sortResponseKeys(Object.keys(record));

    return keys
      .map((status) => {
        const raw = record[status];
        if (!raw || typeof raw !== "object") return null;
        const obj = raw as Record<string, unknown>;

        const description = typeof obj["description"] === "string" ? (obj["description"] as string) : "";
        const { contentType, media } = pickContentType(obj["content"]);
        const schema =
          media && typeof media["schema"] === "object" ? (media["schema"] as Record<string, unknown>) : undefined;

        return { status, description, contentType, schema };
      })
      .filter(Boolean) as ParsedResponse[];
  }, [responses]);

  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const active = parsed.find((p) => p.status === activeStatus) ?? parsed[0];

  const exampleText =
    active?.schema && schemas
      ? prettyPayload(
          generateExampleFromSchema(
            active.schema,
            schemas,
            `${seedSalt ?? ""}:${active.status}:${active.contentType ?? ""}`,
          ),
        )
      : "";

  const exampleLines = (exampleText || "").trimEnd().split("\n");

  if (!active) return null;

  return (
    <section>
      <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold text-gray-900">Responses</h3>

      <div className="overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-sm">
        <div className="flex items-end justify-between border-b border-(--border) bg-(--surface-2) px-3 pt-3">
          <div className="flex gap-2">
            {parsed.map((p) => {
              const isActive = p.status === active.status;
              return (
                <button
                  key={p.status}
                  onClick={() => setActiveStatus(p.status)}
                  className={
                    isActive
                      ? "rounded-t-lg border-b-2 border-emerald-500 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-700 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]"
                      : "rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-(--text-muted) transition-colors hover:bg-(--surface-hover-2) hover:text-(--text-muted)"
                  }
                >
                  {p.status}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
              onClick={() => copyToClipboard(exampleText)}
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>
        </div>
        <div className="bg-[#111827]">
          <div className="flex items-center justify-between gap-4 border-b border-(--border-strong) bg-[rgba(31,41,55,0.5)] px-5 py-2.5 font-mono text-xs font-medium text-(--text-subtle)">
            {active.contentType && <p>{active.contentType}</p>}
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-(--border-strong) bg-[rgba(31,41,55,0.5)] px-5 py-2.5 font-mono text-xs font-medium text-(--text-subtle)">
            {active.description && <p className="text-xs text-[rgba(156,163,175,0.85)]">{active.description}</p>}
          </div>
          <pre
            className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-[rgba(229,231,235,0.9)]"
            style={{ tabSize: 2 }}
          >
            <code className="block">
              {exampleLines.length > 0 ? (
                exampleLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-[2.25rem_1fr] gap-4">
                    <span className="text-right text-[rgba(156,163,175,0.8)] select-none">{idx + 1}</span>
                    <span className="whitespace-pre">{line.length ? line : " "}</span>
                  </div>
                ))
              ) : (
                <div className="text-[rgba(156,163,175,0.85)]">No example available for this response.</div>
              )}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
