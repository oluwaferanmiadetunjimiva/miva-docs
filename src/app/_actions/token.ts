"use server";

import { cookies } from "next/headers";
import { tokenCookieName } from "@/lib/tokenScope";

export async function setScopedToken(args: { serviceSlug: string; envName: string; token: string }): Promise<void> {
  const name = tokenCookieName(args.serviceSlug, args.envName);
  const value = args.token.trim();

  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearScopedToken(args: { serviceSlug: string; envName: string }): Promise<void> {
  const name = tokenCookieName(args.serviceSlug, args.envName);
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

