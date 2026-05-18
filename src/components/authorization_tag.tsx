"use client";

import { Lock,  } from "lucide-react";

export default function AuthorizationTag() {
  return (
    <section>
      <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
        <Lock className="mt-0.5 text-orange-500" />
        <div>
          <h4 className="text-sm font-semibold text-orange-900">Authentication Required</h4>
          <p className="mt-1 text-sm text-orange-800/80">This endpoint requires a Bearer Token.</p>
        </div>
      </div>
    </section>
  );
}
