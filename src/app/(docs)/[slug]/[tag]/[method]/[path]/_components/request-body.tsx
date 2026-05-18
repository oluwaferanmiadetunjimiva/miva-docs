"use client";

import type { OpenApiRequestBody } from "@/lib/openapiSpec";
import { Required } from "@/components/badges";
import { prettyPayload, copyToClipboard } from "@/lib/helpers";
import { generateExampleFromSchema } from "@/lib/generateExampleFromSchema";
import { useMemo } from "react";
import { Copy } from "lucide-react";
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
      <section className="max-w-3xl">
        <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold text-gray-900">Body Parameters</h3>

        <div className="overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-(--border)">
              {computed.rows.map((row) => (
                <tr key={row.name} className="divide-y divide-gray-200 bg-white text-gray-700 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.name}
                    {row.required && <Required />}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.type}</td>

                  <td className="px-4 py-3">
                    {row.description && <div className="mb-2">{row.description}</div>}
                    {row.meta.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-(--text-muted)">
                        {row.meta.map((m) => (
                          <span
                            key={`${row.name}-${m.label}`}
                            className="rounded border border-(--border) bg-(--surface-2) px-2 py-0.5 font-mono text-[11px]"
                          >
                            {m.label}: {m.value}
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

      <section>
        <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold text-gray-900">
          Request Payload Example
        </h3>

        <div className="overflow-hidden rounded-xl border border-(--border-strong) bg-[#111827] shadow-sm">
          <div className="group flex items-center justify-between border-b border-(--border-strong) bg-[rgba(31,41,55,0.5)] px-5 py-2.5 font-mono text-xs font-medium text-(--text-subtle) transition-colors hover:bg-[#1f2937]">
            <span>application/json</span>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 rounded bg-[rgba(55,65,81,0.5)] px-2 py-1 text-[rgba(229,231,235,0.9)] transition-colors group-hover:opacity-100 hover:bg-[rgba(75,85,99,1)] hover:text-white focus:opacity-100"
                onClick={() => copyToClipboard(computed.exampleText)}
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>

              <button
                type="button"
                onClick={() => applyExample(computed.exampleText)}
                className="flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-1 text-emerald-400 transition-colors group-hover:opacity-100 hover:bg-emerald-500/30 hover:text-emerald-300 focus:opacity-100"
              >
                <span>✨</span>
                Use this example
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-[rgba(229,231,235,0.9)]">
            <code>{computed.exampleText}</code>
          </pre>
        </div>
      </section>
    </>
  );
}
