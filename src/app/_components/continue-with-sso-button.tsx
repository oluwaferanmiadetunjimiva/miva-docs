"use client";

import { useState } from "react";
import { LoaderCircle, Shield } from "lucide-react";

type Service = { slug?: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function ContinueWithSSOButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full">
      <button
        id="sso-btn"
        type="button"
        disabled={loading}
        onClick={async () => {
          if (loading) return;
          setLoading(true);
          setError(null);

          const start = Date.now();
          try {
            const res = await fetch("/api/services", { cache: "no-store" });
            if (!res.ok) throw new Error(`Failed to load services (${res.status})`);

            const services = (await res.json()) as Service[];
            const firstSlug = Array.isArray(services) ? services[0]?.slug : undefined;
            if (!firstSlug) throw new Error("No services available");

            const elapsed = Date.now() - start;
            if (elapsed < 1000) await sleep(1000 - elapsed);

            window.location.assign(`/api/select-service?slug=${encodeURIComponent(firstSlug)}`);
          } catch (e) {
            const elapsed = Date.now() - start;
            if (elapsed < 1000) await sleep(1000 - elapsed);
            setLoading(false);
            setError(e instanceof Error ? e.message : "Failed to continue.");
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-wait disabled:opacity-80"
      >
        <Shield className={loading ? "hidden text-lg" : "text-lg"} />
        <LoaderCircle className={loading ? "text-lg animate-spin" : "hidden text-lg"} />
        <span id="sso-text">{loading ? "Loading…" : "Continue with SSO"}</span>
      </button>

      {error && <div className="mt-3 text-xs font-medium text-rose-600">{error}</div>}
    </div>
  );
}

