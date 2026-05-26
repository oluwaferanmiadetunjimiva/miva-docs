"use client";

import { cn } from "@/lib/cn";

type MethodProps = {
  method: string;
  className?: string;
};

export function Method({ method, className }: MethodProps) {
  const key = method.toLowerCase();

  const styles: Record<string, { label: string; className: string }> = {
    get: {
      label: "GET",
      className:
        "bg-[#eaf2ff] text-[#0a66c2] ring-1 ring-inset ring-[#cfdcf2] dark:bg-[#0a84ff]/12 dark:text-[#8ec5ff] dark:ring-[#0a84ff]/25",
    },
    post: {
      label: "POST",
      className:
        "bg-[#e7f6ee] text-[#117a3f] ring-1 ring-inset ring-[#c8e3d3] dark:bg-[#34c759]/12 dark:text-[#7ee2a3] dark:ring-[#34c759]/25",
    },
    put: {
      label: "PUT",
      className:
        "bg-[#eee9ff] text-[#5d4ac2] ring-1 ring-inset ring-[#d5cdf0] dark:bg-[#bf5af2]/12 dark:text-[#d8b4f8] dark:ring-[#bf5af2]/25",
    },
    patch: {
      label: "PATCH",
      className:
        "bg-[#fff4e0] text-[#8a5a0a] ring-1 ring-inset ring-[#f0dfb8] dark:bg-[#ff9f0a]/12 dark:text-[#ffd28a] dark:ring-[#ff9f0a]/25",
    },
    delete: {
      label: "DELETE",
      className:
        "bg-[#fde9ea] text-[#b8232f] ring-1 ring-inset ring-[#f1c8cb] dark:bg-[#ff453a]/12 dark:text-[#ff9b95] dark:ring-[#ff453a]/25",
    },
  };

  const style = styles[key];
  if (!style) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
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
  return (
    <span className={cn("ml-1 text-[#ff3b30] dark:text-[#ff453a]", className)} aria-label="required">
      *
    </span>
  );
};
