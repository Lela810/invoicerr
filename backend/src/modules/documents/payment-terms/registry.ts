import { defaultComposedCountryCatalog } from '../countries/registry';
import { CountryDefaultPaymentTerm, CountryPaymentTermsFile, hasPaymentTermCap } from './schema';

/** The country's payment-term cap, or `null` when its file declares none: no known cap, never a
 *  guessed one. */
export function paymentTermsCapFor(
  countryCode: string,
): (CountryPaymentTermsFile & { maxNetDays: number; maxEndOfMonthDays: number }) | null {
  const file = defaultComposedCountryCatalog.get(countryCode)?.paymentTerms;
  if (!file || !hasPaymentTermCap(file)) return null;
  return file as CountryPaymentTermsFile & { maxNetDays: number; maxEndOfMonthDays: number };
}

/** The term that applies when the parties agreed none, or `null` when the country's file has none. */
export function defaultPaymentTermFor(countryCode: string): CountryDefaultPaymentTerm | null {
  return defaultComposedCountryCatalog.get(countryCode)?.paymentTerms?.defaultTerm ?? null;
}
