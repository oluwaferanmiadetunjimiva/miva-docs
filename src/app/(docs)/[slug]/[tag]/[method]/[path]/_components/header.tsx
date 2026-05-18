"use client";

import { Method } from "@/components/badges";
import { copyToClipboard } from "@/lib/helpers";
import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  method: string;
  path?: string;
  summary?: string;
  description?: string;
};

export default function Header({ method, description, path, summary }: Props) {
  return (
    <>
      <header>
        <div className="mb-6 flex items-center gap-4">
          <Method method={method} className="px-2.5 py-1 text-xs" />

          <h1 className="font-mono text-lg text-gray-500">{path}</h1>

          <button
            type="button"
            className="rounded-md bg-transparent p-1 text-(--text-subtle) transition duration-150 hover:scale-120 hover:text-(--text) focus:scale-110 focus:text-(--text) focus:outline-none"
            onClick={() => copyToClipboard(window.location.href)}
            aria-label="Copy page URL"
            title="Copy page URL"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {summary && <h2 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900">{summary}</h2>}
        {description && (
          <div className="prose prose-xs prose-headings:text-(--text-muted) prose-strong:text-(--text-muted) prose-a:text-(--text-muted) prose-code:text-(--text-muted) prose-pre:bg-(--surface) prose-pre:text-(--text-muted) prose-pre:border prose-pre:border-(--border) max-w-4xl rounded-lg bg-(--surface-hover) px-4 py-3 text-sm leading-relaxed text-gray-600">
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

      <hr className="border-(--border)" />
    </>
  );
}
