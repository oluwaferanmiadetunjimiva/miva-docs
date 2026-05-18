"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Command } from "lucide-react";

type LoaderState = "loading" | "success" | "error";

export default function Loading() {
  const [state, setState] = useState<LoaderState>("loading");

  const errorDetails = useMemo(() => {
    return "YAMLException: bad indentation of a mapping entry (line 42, column 5)";
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-[#FAFAFA] text-sm text-gray-900 antialiased selection:bg-gray-200">
      <div className="relative w-full max-w-105 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#161B22] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
        <div className={`${state === "loading" ? "flex" : "hidden"} flex-col`}>
          <div className="flex flex-col items-center border-b border-gray-100 p-8 pb-6 text-center dark:border-gray-800/60">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <Command className="text-gray-700 dark:text-gray-300" size={24} strokeWidth={1.5} />
            </div>
            <h1 className="mb-1.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">API Console</h1>
            <h2 className="mb-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">Loading API specification</h2>
            <p className="max-w-65 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
              Fetching and preparing your API documentation...
            </p>
          </div>

          <div className="bg-[#FCFCFC] p-6 dark:bg-[#0E1116]/50">
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="shrink-0 text-emerald-500" size={18} />
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Fetching OpenAPI file</span>
                <span className="ml-auto rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                  openapi.yaml
                </span>
              </li>

              <li className="flex items-center gap-3">
                <svg
                  className="h-4.5 w-4.5 shrink-0 animate-spin text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Parsing specification</span>
              </li>

              <li className="flex items-center gap-3 opacity-40">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                </div>
                <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                  Building endpoint routes
                </span>
              </li>

              <li className="flex items-center gap-3 opacity-40">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                </div>
                <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                  Preparing request console
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className={`${state === "success" ? "flex" : "hidden"} flex-col`}>
          <div className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
            </div>
            <h1 className="mb-1.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              Specification loaded
            </h1>
            <p className="mb-6 max-w-65 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
              Opening first endpoint...
            </p>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-[#FCFCFC] px-3.5 py-1.5 text-xs font-medium text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
              <svg
                className="h-3.5 w-3.5 animate-spin text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Redirecting
            </div>
          </div>
        </div>

        <div className={`${state === "error" ? "flex" : "hidden"} flex-col`}>
          <div className="flex flex-col items-center border-b border-gray-100 p-8 pb-6 text-center dark:border-gray-800/60">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10">
              <AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />
            </div>
            <h1 className="mb-1.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              Could not load API specification
            </h1>
            <p className="max-w-65 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
              We encountered an issue while parsing your openapi.yaml file.
            </p>
          </div>

          <div className="flex flex-col gap-4 bg-[#FCFCFC] p-6 dark:bg-[#0E1116]/50">
            <div className="overflow-x-auto rounded-lg border border-rose-100 bg-rose-50/50 p-3.5 dark:border-rose-500/10 dark:bg-rose-500/5">
              <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-rose-800 uppercase dark:text-rose-400">
                Error Details
              </div>
              <code className="font-mono text-[11px] whitespace-nowrap text-rose-700 dark:text-rose-300">
                {errorDetails}
              </code>
            </div>

            <button
              type="button"
              onClick={() => setState("loading")}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-gray-800 active:scale-[0.98] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
