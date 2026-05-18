import "server-only";

import { cookies } from "next/headers";
import { tokenCookieName } from "@/lib/tokenScope";

export async function getScopedTokenFromCookies(args: { serviceSlug: string; envName: string }): Promise<string | undefined> {
  const cookieStore = await cookies();
  const name = tokenCookieName(args.serviceSlug, args.envName);
  const v = cookieStore.get(name)?.value;
  return v && v.trim().length > 0 ? v : undefined;
}

