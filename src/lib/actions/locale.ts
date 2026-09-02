"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, isAppLocale, type AppLocale } from "@/i18n/config";

export async function setLocaleAction(formData: FormData) {
  const raw = String(formData.get("locale") ?? "");
  const locale: AppLocale = isAppLocale(raw) ? raw : defaultLocale;

  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const referer = (await headers()).get("referer");
  let nextPath = "/";
  if (referer) {
    try {
      const url = new URL(referer);
      nextPath = `${url.pathname}${url.search}` || "/";
    } catch {
      nextPath = "/";
    }
  }
  redirect(nextPath);
}
