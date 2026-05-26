"use client";

import { Method } from "@/components/badges";
import { copyToClipboard } from "@/lib/helpers";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  method: string;
  path?: string;
  summary?: string;
  description?: string;
};

export default function Header({ method, description, path, summary }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <header className="md-fade-in">
      <div className="mb-5 flex items-center gap-3">
        <Method method={method} className="px-2 py-0.5 text-[10.5px]" />
        <h1 className="truncate font-mono text-[14px] tracking-tight text-(--text-muted)">{path}</h1>
        <button
          type="button"
          onClick={() => {
            copyToClipboard(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          aria-label="Copy page URL"
          title={copied ? "Copied" : "Copy page URL"}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-(--text-subtle) transition-all duration-200 ease-[var(--ease-apple)] hover:scale-105 hover:bg-(--surface-hover) hover:text-(--text) active:scale-95"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-(--accent)" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {summary && (
        <h2 className="mb-3 text-[28px] leading-[1.15] font-semibold tracking-tight text-(--text)">
          {summary}
        </h2>
      )}

      {description && (
        <div className="prose prose-sm max-w-3xl text-[14px] leading-relaxed text-(--text-muted) prose-headings:text-(--text) prose-strong:text-(--text) prose-a:text-(--accent) prose-code:rounded prose-code:bg-(--surface-3) prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[12.5px] prose-code:text-(--text) prose-pre:rounded-lg prose-pre:bg-(--surface-3) prose-pre:text-(--text)">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, href, ...props }) => (
                <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {description}
          </ReactMarkdown>
        </div>
      )}
    </header>
  );
}
