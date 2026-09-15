import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { AppLocale } from "@/i18n/config";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek"],
  variable: "--font-source",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: {
      default: t("title"),
      template: "%s · WineBloom",
    },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      images: ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/og.png"],
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir="ltr"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className={`${body.className} min-h-full flex flex-col`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
