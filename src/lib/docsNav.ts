export function withEnvQuery(href: string, env: string | undefined): string {
  const e = (env ?? "").trim();
  if (!e) return href;
  const idx = href.indexOf("?");
  const path = idx === -1 ? href : href.slice(0, idx);
  const query = idx === -1 ? "" : href.slice(idx + 1);
  const sp = new URLSearchParams(query);
  sp.set("env", e);
  return `${path}?${sp.toString()}`;
}
