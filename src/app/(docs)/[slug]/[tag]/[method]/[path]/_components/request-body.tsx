"use client";

import type { OpenApiRequestBody } from "@/lib/openapiSpec";
import { Required } from "@/components/badges";
import { prettyPayload, copyToClipboard } from "@/lib/helpers";
import { generateExampleFromSchema } from "@/lib/generateExampleFromSchema";
import { useMemo, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { usePlaygroundBody } from "./playground-body-context";

type Row = {
  name: string;
  required: boolean;
  type: string;
  description: string;
  meta: { label: string; value: string }[];
};

type Props = {
  request_body: OpenApiRequestBody | undefined;
  schemas?: Record<string, unknown>;
  seedSalt?: string;
};

function extractSchemaRefName(ref: string): string | null {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match?.[1] ?? null;
}

function describeSchemaType(schema: Record<string, unknown> | undefined): string {
  if (!schema) return "unknown";

  const ref = schema["$ref"];
  if (typeof ref === "string") {
    return extractSchemaRefName(ref) ?? "ref";
  }

  const type = schema["type"];

  if (typeof type === "string") return type;

  if (Array.isArray(schema["enum"])) return "enum";
  return "object";
}

function getFieldMeta(schema: Record<string, unknown> | undefined): { label: string; value: string }[] {
  if (!schema) return [];

  const meta: { label: string; value: string }[] = [];

  const format = schema["format"];
  if (typeof format === "string" && format) meta.push({ label: "format", value: format });

  const minLength = schema["minLength"];
  if (typeof minLength === "number") meta.push({ label: "minLength", value: String(minLength) });

  const maxLength = schema["maxLength"];
  if (typeof maxLength === "number") meta.push({ label: "maxLength", value: String(maxLength) });

  const minimum = schema["minimum"];
  if (typeof minimum === "number") meta.push({ label: "minimum", value: String(minimum) });

  const maximum = schema["maximum"];
  if (typeof maximum === "number") meta.push({ label: "maximum", value: String(maximum) });

  const pattern = schema["pattern"];
  if (typeof pattern === "string" && pattern) meta.push({ label: "pattern", value: pattern });

  const example = schema["example"];
  if (example !== undefined) meta.push({ label: "example", value: String(example) });

  const defaultValue = schema["default"];
  if (defaultValue !== undefined) meta.push({ label: "default", value: String(defaultValue) });

  const nullable = schema["nullable"];
  if (typeof nullable === "boolean") meta.push({ label: "nullable", value: String(nullable) });

  const items = schema["items"];
  if (items && typeof items === "object") {
    meta.push({ label: "items", value: describeSchemaType(items as Record<string, unknown>) });
  }

  const enumValues = schema["enum"];
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    meta.push({ label: "enum", value: enumValues.map((v) => String(v)).join(", ") });
  }

  return meta;
}

export default function RequestBody({ request_body, schemas, seedSalt }: Props) {
  const { applyExample } = usePlaygroundBody();
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const computed = useMemo<{ rows: Row[]; exampleText: string }>(() => {
    if (!request_body) {
      return { rows: [], exampleText: "" };
    }

    const content = request_body["content"] as Record<string, unknown> | undefined;

    const appJson = content?.["application/json"] as Record<string, unknown> | undefined;
    const bodySchema = appJson?.["schema"] as Record<string, unknown> | undefined;

    const bodyRef = typeof bodySchema?.["$ref"] === "string" ? (bodySchema?.["$ref"] as string) : null;
    const bodySchemaName = bodyRef ? extractSchemaRefName(bodyRef) : null;
    const resolvedBodySchema =
      bodySchemaName && schemas ? (schemas[bodySchemaName] as Record<string, unknown> | undefined) : undefined;

    const properties = (resolvedBodySchema?.["properties"] as Record<string, unknown> | undefined) ?? {};
    const required = new Set(
      Array.isArray(resolvedBodySchema?.["required"])
        ? (resolvedBodySchema?.["required"] as unknown[]).map((v) => String(v))
        : [],
    );

    const rows: Row[] = Object.entries(properties).map(([name, raw]) => {
      const schema = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
      const meta = getFieldMeta(schema);
      return {
        name,
        required: required.has(name),
        type: describeSchemaType(schema),
        description: typeof schema?.["description"] === "string" ? (schema["description"] as string) : "",
        meta,
      };
    });

    let exampleText = "";
    if (resolvedBodySchema && schemas) {
      const salt = `${seedSalt ?? ""}:${bodySchemaName ?? "unknown"}`;
      const example = generateExampleFromSchema(resolvedBodySchema, schemas, salt);
      exampleText = prettyPayload(example);
    }

    return { rows, exampleText };
  }, [request_body, schemas, seedSalt]);

  if (!request_body || computed.rows.length === 0) return <></>;

  return (
    <>
      <section className="md-fade-in max-w-3xl">
        <h3 className="mb-3 text-[13px] font-semibold tracking-tight text-(--text)">Body parameters</h3>

        <div className="overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-[var(--shadow-xs)]">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-(--border) bg-(--surface-2) text-(--text-subtle)">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase">Name</th>
                <th className="px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase">Description</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-(--border)">
              {computed.rows.map((row) => (
                <tr key={row.name} className="bg-(--surface) text-(--text-muted) transition-colors">
                  <td className="px-4 py-3 font-mono text-[12.5px] text-(--text)">
                    {row.name}
                    {row.required && <Required />}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-(--text-subtle)">{row.type}</td>
                  <td className="px-4 py-3">
                    {row.description && <div className="mb-1.5 leading-relaxed">{row.description}</div>}
                    {row.meta.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.meta.map((m) => (
                          <span
                            key={`${row.name}-${m.label}`}
                            className="rounded-md bg-(--surface-3) px-1.5 py-0.5 font-mono text-[11px] text-(--text-subtle) ring-1 ring-inset ring-(--border)"
                          >
                            <span className="text-(--text-muted)">{m.label}:</span> {m.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="md-fade-in">
        <h3 className="mb-3 text-[13px] font-semibold tracking-tight text-(--text)">Request payload example</h3>

        <div className="overflow-hidden rounded-xl border border-(--border) bg-[#0c0c10] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-[11.5px] font-medium text-white/55">
            <div className="flex items-center gap-2">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-[#ff5f57]/85" />
                <span className="h-2 w-2 rounded-full bg-[#febc2e]/85" />
                <span className="h-2 w-2 rounded-full bg-[#28c840]/85" />
              </span>
              <span className="ml-1.5">application/json</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-white/65 transition-colors duration-150 hover:bg-white/8 hover:text-white"
                onClick={() => {
                  copyToClipboard(computed.exampleText);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? <Check className="h-3 w-3 text-[#7ee2a3]" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  applyExample(computed.exampleText);
                  setApplied(true);
                  window.setTimeout(() => setApplied(false), 1400);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-(--accent)/20 px-2 py-1 text-[11.5px] text-[#7eb8ff] transition-colors duration-150 hover:bg-(--accent)/30 hover:text-[#a8d0ff]"
              >
                <Sparkles className="h-3 w-3" />
                {applied ? "Applied" : "Use this example"}
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/85">
            <code>{computed.exampleText}</code>
          </pre>
        </div>
      </section>
    </>
  );
}
