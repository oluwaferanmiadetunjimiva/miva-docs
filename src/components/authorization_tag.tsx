"use client";

import { Lock } from "lucide-react";

export default function AuthorizationTag() {
  return (
    <section className="md-fade-in">
      <div className="flex max-w-3xl items-start gap-3 rounded-xl border border-(--border) bg-(--surface) p-4 shadow-[var(--shadow-xs)]">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff4e0] text-[#8a5a0a] ring-1 ring-inset ring-[#f0dfb8] dark:bg-[#ff9f0a]/12 dark:text-[#ffd28a] dark:ring-[#ff9f0a]/25">
          <Lock className="h-3.5 w-3.5" />
        </div>
        <div>
          <h4 className="text-[13.5px] font-semibold text-(--text)">Authentication required</h4>
          <p className="mt-0.5 text-[13px] text-(--text-muted)">
            This endpoint requires a Bearer token. Set one in the playground to send requests.
          </p>
        </div>
      </div>
    </section>
  );
}
