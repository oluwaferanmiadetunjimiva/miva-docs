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
    <div className="group relative cursor-pointer">
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
        className="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pr-8 pl-3 text-sm font-semibold tracking-tight text-gray-900 shadow-sm transition-shadow outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-gray-600" />
    </div>
  );
}

