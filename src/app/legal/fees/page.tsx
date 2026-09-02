import { getTranslations } from "next-intl/server";
import {
  formatBpsAsPercent,
  formatEur,
  PLAN_DEFAULTS,
} from "@/lib/commerce/fees";

export async function generateMetadata() {
  const t = await getTranslations("fees");
  return { title: t("title") };
}

export default async function FeesPage() {
  const t = await getTranslations("fees");
  const ts = await getTranslations("sell");
  const plans = Object.values(PLAN_DEFAULTS);

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">{t("intro")}</p>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("buyersTitle")}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--ink-soft)]">
          <li>{t("buyerPrice")}</li>
          <li>{t("buyerShipping")}</li>
          <li>{t("buyerTax")}</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("plansTitle")}</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--ink-soft)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("plan")}</th>
                <th className="px-4 py-3 font-medium">{t("monthly")}</th>
                <th className="px-4 py-3 font-medium">{t("commission")}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.code} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{p.code}</td>
                  <td className="px-4 py-3">
                    {p.monthlyPriceCents === 0
                      ? ts("free")
                      : p.code === "ENTERPRISE"
                        ? t("from", { amount: formatEur(p.monthlyPriceCents) })
                        : formatEur(p.monthlyPriceCents)}
                  </td>
                  <td className="px-4 py-3">
                    {p.code === "ENTERPRISE"
                      ? t("negotiated")
                      : formatBpsAsPercent(p.commissionBps)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("processingTitle")}</h2>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">{t("processingBody")}</p>
      </section>
    </div>
  );
}
