"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  tagSlug: string;
  children: ReactNode;
};

export default function SidebarSection({ title, tagSlug, children }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const containsActive = segments[1] === tagSlug;

  const [isOpen, setIsOpen] = useState<boolean>(containsActive);

  useEffect(() => {
    if (containsActive) setIsOpen(true);
  }, [containsActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-[10.5px] font-semibold tracking-[0.12em] text-(--text-subtle) uppercase transition-colors duration-150 hover:text-(--text-muted)"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-[var(--ease-apple)]",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {isOpen && <ul className="space-y-0.5">{children}</ul>}
    </div>
  );
}
