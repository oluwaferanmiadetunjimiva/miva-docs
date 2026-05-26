"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type Service = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  initialSlug?: string | null;
};

export default function ServiceSelect({ initialSlug }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [value, setValue] = useState(initialSlug ?? "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/services", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Service[];
        if (cancelled) return;
        setServices(Array.isArray(json) ? json : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackSlug = useMemo(() => services[0]?.slug ?? "", [services]);
  const effectiveValue = value || initialSlug || fallbackSlug;

  return (
    <div className="group relative">
      <select
        value={effectiveValue}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (next) {
            if (process.env.NODE_ENV === "development") {
              console.info("[miva-docs][ServiceSelect] switch service", {
                slug: next,
                navigateTo: `/api/select-service?slug=${encodeURIComponent(next)}`,
              });
            }

            window.location.assign(`/api/select-service?slug=${encodeURIComponent(next)}`);
          }
        }}
        className="w-full cursor-pointer appearance-none rounded-lg border border-(--border) bg-(--surface) py-1.5 pr-8 pl-3 text-[13px] font-medium tracking-tight text-(--text) shadow-[var(--shadow-xs)] transition-all duration-150 outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-(--ring) hover:bg-(--surface-hover-2)"
      >
        {services.length === 0 ? (
          <option value={effectiveValue}>{effectiveValue ? effectiveValue : "Loading…"}</option>
        ) : (
          services.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-(--text-subtle) transition-colors duration-150 group-hover:text-(--text-muted)" />
    </div>
  );
}
