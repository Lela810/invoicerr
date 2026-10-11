import { defaultComposedCountryCatalog } from '../countries/registry';
import { CountryFallbackPaymentTerm, CountryPaymentTermsFile, hasPaymentTermCap } from './schema';

/** The country's payment-term cap, or `null` when its file declares none: no known cap, never a
 *  guessed one. */
export function paymentTermsCapFor(
  countryCode: string,
): (CountryPaymentTermsFile & { maxNetDays: number; maxEndOfMonthDays: number }) | null {
  const file = defaultComposedCountryCatalog.get(countryCode)?.paymentTerms;
  if (!file || !hasPaymentTermCap(file)) return null;
  return file as CountryPaymentTermsFile & { maxNetDays: number; maxEndOfMonthDays: number };
}

/** The country's fallback term for an invoice's due date, or `null` when its file declares none. */
export function fallbackPaymentTermFor(countryCode: string): CountryFallbackPaymentTerm | null {
  return defaultComposedCountryCatalog.get(countryCode)?.paymentTerms?.fallbackTerm ?? null;
}
