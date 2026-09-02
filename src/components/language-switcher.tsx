"use client";

import {
  isAppLocale,
  locales,
  type AppLocale,
} from "@/i18n/config";
import { setLocaleAction } from "@/lib/actions/locale";

/** High-contrast native select — submits a server action on change. */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: string;
  label: string;
}) {
  const safe: AppLocale = isAppLocale(current) ? current : "en";

  return (
    <form
      action={setLocaleAction}
      className="flex shrink-0 items-center"
    >
      <label
        htmlFor="wt-locale"
        className="sr-only"
      >
        {label}
      </label>
      <select
        id="wt-locale"
        name="locale"
        defaultValue={safe}
        key={safe}
        aria-label={label}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit();
        }}
        style={{
          width: "4.25rem",
          height: "2rem",
          padding: "0.25rem 0.45rem",
          borderRadius: "999px",
          border: "1px solid rgba(20, 17, 15, 0.28)",
          backgroundColor: "#ffffff",
          color: "#14110f",
          fontSize: "0.75rem",
          fontWeight: 600,
          lineHeight: 1.2,
          cursor: "pointer",
        }}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {locale.toUpperCase()}
          </option>
        ))}
      </select>
    </form>
  );
}
