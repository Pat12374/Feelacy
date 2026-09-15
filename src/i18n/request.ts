import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("NEXT_LOCALE")?.value;
  // Invalid/removed locales (e.g. former "ar") fall back to English
  const locale = raw && isAppLocale(raw) ? raw : defaultLocale;

  return {
    locale,
    // Seller catalog import tools deliberately use English until reviewed translations exist.
    messages: {
      ...(await import(`../../messages/${locale}.json`)).default,
      catalogImport: (await import("../../messages/en.json")).default.catalogImport,
    },
  };
});
