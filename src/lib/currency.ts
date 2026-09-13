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

export function getCurrencySymbol(currency: string = "ZAR"): string {
  try {
    return (
      new Intl.NumberFormat(getCurrencyLocale(currency), { style: "currency", currency: currency || "ZAR" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value || currency || "ZAR"
    );
  } catch {
    return currency || "ZAR";
  }
}

export function formatCurrencyValue(amount: number, currency: string = "ZAR", decimals: number = 2): string {
  const cur = currency || "ZAR";
  try {
    return new Intl.NumberFormat(getCurrencyLocale(cur), {
      style: "currency",
      currency: cur,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0);
  } catch {
    return `${cur} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}

export function formatCurrency(amount: number, currency: string = "ZAR"): string {
  return formatCurrencyValue(amount, currency, 2);
}

export function useCurrency() {
  const { currentCompany } = useAuth();
  const currency = currentCompany?.currency || "ZAR";
  const symbol = getCurrencySymbol(currency);

  const format = (amount: number, decimals: number = 2) => formatCurrencyValue(amount, currency, decimals);
  const formatWhole = (amount: number) => formatCurrencyValue(amount, currency, 0);

  return { currency, symbol, format, formatWhole };
}
