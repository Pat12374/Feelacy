export const locales = [
  "en",
  "es",
  "de",
  "zh",
  "fr",
  "ru",
  "hi",
  "pt",
  "bn",
  "it",
] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

/** Native-script names for the open menu */
export const localeNames: Record<AppLocale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  zh: "中文",
  fr: "Français",
  ru: "Русский",
  hi: "हिन्दी",
  pt: "Português",
  bn: "বাংলা",
  it: "Italiano",
};

/** Latin labels so the closed control never looks empty if a script font fails */
export const localeLabels: Record<AppLocale, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  zh: "Chinese",
  fr: "French",
  ru: "Russian",
  hi: "Hindi",
  pt: "Portuguese",
  bn: "Bengali",
  it: "Italian",
};

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
