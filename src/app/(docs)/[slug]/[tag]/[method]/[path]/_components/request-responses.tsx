"use client";

import { prettyPayload, copyToClipboard } from "@/lib/helpers";
import { generateExampleFromSchema } from "@/lib/generateExampleFromSchema";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

function statusToneClass(status: string): string {
  const code = Number(status);
  if (Number.isFinite(code)) {
    if (code >= 200 && code < 300) return "text-[#117a3f] dark:text-[#7ee2a3]";
    if (code >= 300 && code < 400) return "text-[#0a66c2] dark:text-[#8ec5ff]";
    if (code >= 400 && code < 500) return "text-[#8a5a0a] dark:text-[#ffd28a]";
    if (code >= 500) return "text-[#b8232f] dark:text-[#ff9b95]";
  }
  return "text-(--text-muted)";
}

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
  const [copied, setCopied] = useState(false);

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
    <section className="md-fade-in">
      <h3 className="mb-3 text-[13px] font-semibold tracking-tight text-(--text)">Responses</h3>

      <div className="overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-(--border) bg-(--surface-2) px-2.5 py-2">
          <div className="inline-flex rounded-lg bg-(--surface-3) p-0.5 ring-1 ring-inset ring-(--border)">
            {parsed.map((p) => {
              const isActive = p.status === active.status;
              return (
                <button
                  key={p.status}
                  onClick={() => setActiveStatus(p.status)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-mono text-[11.5px] font-semibold transition-all duration-200",
                    isActive
                      ? "bg-(--surface) shadow-[var(--shadow-xs)]"
                      : "hover:bg-(--surface-hover-2)",
                    isActive ? statusToneClass(p.status) : "text-(--text-muted)",
                  )}
                >
                  {p.status}
                </button>
              );
            })}
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-hover) hover:text-(--text)"
            onClick={() => {
              copyToClipboard(exampleText);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? <Check className="h-3 w-3 text-(--accent)" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="bg-[#0c0c10]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-2 font-mono text-[11.5px] font-medium text-white/55">
            <span>{active.contentType ?? "—"}</span>
            <span className={cn("font-semibold tracking-wide", statusToneClass(active.status))}>{active.status}</span>
          </div>
          {active.description && (
            <div className="border-b border-white/10 px-5 py-2 text-[12px] text-white/55">{active.description}</div>
          )}
          <pre
            className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/85"
            style={{ tabSize: 2 }}
          >
            <code className="block">
              {exampleLines.length > 0 ? (
                exampleLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-[2.25rem_1fr] gap-4">
                    <span className="text-right text-white/35 select-none">{idx + 1}</span>
                    <span className="whitespace-pre">{line.length ? line : " "}</span>
                  </div>
                ))
              ) : (
                <div className="text-white/55">No example available for this response.</div>
              )}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
