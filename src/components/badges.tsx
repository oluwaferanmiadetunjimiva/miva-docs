"use client";

import { cn } from "@/lib/cn";

type MethodProps = {
  method: string;
  className?: string;
};

export function Method({ method, className }: MethodProps) {
  const key = method.toLowerCase();

  const styles: Record<string, { label: string; className: string }> = {
    post: { label: "POST", className: "bg-emerald-100 border-emerald-200 text-emerald-800" },
    get: { label: "GET", className: "bg-blue-100 border-blue-200 text-blue-800" },
    patch: { label: "PATCH", className: "bg-amber-100 border-amber-200 text-amber-800" },
    put: { label: "PUT", className: "bg-violet-100 border-violet-200 text-violet-800" },
    delete: { label: "DELETE", className: "bg-rose-100 border-rose-200 text-rose-800" },
  };

  const style = styles[key];
  if (!style) return null;

  return (
    <span
      className={cn(
        "rounded-md border px-2 py-1 text-center font-mono text-[10px] font-semibold",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

type RequiredProps = {
  className?: string;
};

export const Required = ({ className }: RequiredProps) => {
  return <span className={cn("ml-1 text-red-500", className)}>*</span>;
};
