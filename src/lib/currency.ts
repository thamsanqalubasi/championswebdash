/**
 * Shared currency formatting utility.
 * Uses the company currency stored in auth context.
 * Import and use this instead of hardcoded ZAR/NAD.
 */
import { useAuth } from "@/lib/auth";

const CURRENCY_LOCALES: Record<string, string> = {
  ZAR: "en-ZA", NAD: "en-NA", USD: "en-US", EUR: "de-DE",
  GBP: "en-GB", KES: "en-KE", BWP: "en-BW", ZMW: "en-ZM",
  MWK: "en-MW", TZS: "en-TZ", UGX: "en-UG", MZN: "pt-MZ",
  AOA: "pt-AO", NGN: "en-NG", GHS: "en-GH", EGP: "en-EG",
  MAD: "ar-MA", XAF: "fr-CM", XOF: "fr-SN",
};

function getCurrencyLocale(currency: string): string {
  return CURRENCY_LOCALES[currency] || "en-US";
}

export function formatCurrencyValue(amount: number, currency: string): string {
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: "currency",
    currency: currency || "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function useCurrency() {
  const { currentCompany } = useAuth();
  const currency = currentCompany?.currency || "ZAR";
  const symbol = (() => {
    try {
      return new Intl.NumberFormat(getCurrencyLocale(currency), { style: "currency", currency })
        .formatToParts(0)
        .find(p => p.type === "currency")?.value || currency;
    } catch { return currency; }
  })();

  const format = (amount: number) => formatCurrencyValue(amount, currency);
  return { currency, symbol, format };
}
