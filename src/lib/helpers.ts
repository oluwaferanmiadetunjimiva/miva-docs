import { toast } from "react-hot-toast";

export const copyToClipboard = async (text: string, message = "Copied to clipboard!") => {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
};

export function slugifyOperationId(id: string): string {
  return (
    id
      // split camelCase / PascalCase → spaces
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      // handle ALLCAPS → words (e.g. getHTTPUser → get HTTP User)
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      // replace non-alphanumeric with space
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase()
      // join with dashes
      .replace(/\s+/g, "-")
  );
}

export function getPrimaryOpenApiTag(tags: string[] | undefined): string {
  const first = tags?.[0];
  const normalized = typeof first === "string" ? first.trim() : "";
  return normalized || "default";
}

export function normalizeLegacyOpenApiTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  return normalized || "default";
}

export function slugifyOpenApiTag(tag: string): string {
  const slug = normalizeLegacyOpenApiTag(tag)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return slug || "default";
}

export function matchesOpenApiTagRoute(routeTag: string, tags: string[] | undefined): boolean {
  const target = normalizeLegacyOpenApiTag(routeTag);
  const candidates = tags?.length ? tags : ["default"];

  return candidates.some((tag) => {
    const normalized = typeof tag === "string" ? tag.trim() : "";
    if (!normalized) return false;

    return target === normalizeLegacyOpenApiTag(normalized) || target === slugifyOpenApiTag(normalized);
  });
}

export function buildDocsOperationRoute(args: {
  serviceSlug: string;
  tag: string;
  method: string;
  operationId: string;
}): string {
  const serviceSlug = args.serviceSlug.trim().toLowerCase();
  const tag = slugifyOpenApiTag(args.tag);
  const method = args.method.trim().toLowerCase();
  const opSlug = slugifyOperationId(args.operationId);
  return `/${serviceSlug}/${tag}/${method}/${opSlug}`;
}

export function prettyPayload(payload: unknown): string {
  try {
    const v = typeof payload === "string" ? JSON.parse(payload) : payload;
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return String(payload ?? "");
  }
}
