export const TOKEN_LOCALSTORAGE_PREFIX = "miva_docs_token";
export const TOKEN_COOKIE_PREFIX = "token__";

function normalizePart(part: string): string {
  const t = part.trim();
  if (!t) return "";
  return t.toLowerCase();
}

function encodeForCookieName(part: string): string {
  const s = normalizePart(part);
  let out = "";
  for (const ch of s) {
    if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch === "_" || ch === "-") {
      out += ch;
    } else {
      out += "_" + ch.codePointAt(0)!.toString(16);
    }
  }
  return out || "unknown";
}

export function tokenScopeKey(serviceSlug: string, envName: string): string {
  return `${TOKEN_LOCALSTORAGE_PREFIX}:${normalizePart(serviceSlug)}:${normalizePart(envName)}`;
}

export function tokenCookieName(serviceSlug: string, envName: string): string {
  const s = encodeForCookieName(serviceSlug);
  const e = encodeForCookieName(envName);
  return `${TOKEN_COOKIE_PREFIX}${s}__${e}`;
}

