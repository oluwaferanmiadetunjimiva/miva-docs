"use client";

import { useMemo, useSyncExternalStore } from "react";

function formatRelativeTime(fromMs: number, toMs: number): string {
  const diffSec = Math.round((toMs - fromMs) / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });

  if (abs < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, "day");
}

function subscribeMinuteTick(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(id);
}

type Props = {
  lastModified?: string;
  apiVersion?: string;
};

function formatVersionBadge(version: string): string {
  const t = version.trim();
  if (!t) return "—";
  return /^v/i.test(t) ? t : `v${t}`;
}

export default function ServiceStatus({ lastModified, apiVersion }: Props) {
  const nowMs = useSyncExternalStore(
    subscribeMinuteTick,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );

  const updatedLabel = useMemo(() => {
    if (!lastModified) return "";
    const ms = Date.parse(lastModified);
    if (Number.isNaN(ms)) return "";
    if (nowMs === 0) return "";
    return `Updated ${formatRelativeTime(ms, nowMs)}`;
  }, [lastModified, nowMs]);

  return (
    <div className="mt-2.5 flex items-center justify-between px-0.5">
      <div className="flex items-center gap-2 text-[10px] font-medium tracking-wider text-gray-500 uppercase">
        <span className="rounded bg-gray-200/50 px-1.5 py-0.5 font-mono font-semibold text-gray-600">
          {apiVersion ? formatVersionBadge(apiVersion) : "—"}
        </span>

      </div>
      <span className="text-[10px] font-medium text-gray-400">{updatedLabel}</span>
    </div>
  );
}

