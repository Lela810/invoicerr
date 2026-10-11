/**
 * The country catalog format for two payment-term facts, each optional:
 *  - the longest term the country's law lets two businesses agree on, counted from the invoice's
 *    issue date (a country without one is never warned about);
 *  - the term that applies when the parties agreed none, used to prefill an invoice's due date
 *    when the company has no default of its own.
 *
 * Reuses `country-policy/schema.ts`'s provenance union, like every sibling catalog.
 */
import {
  assertValidPolicyProvenance,
  InvalidPolicyProvenanceError,
  PolicyProvenance,
} from '../country-policy/schema';

export interface CountryDefaultPaymentTerm {
  /** Calendar days after the invoice date. */
  days: number;
  provenance: PolicyProvenance;
  notes?: string;
}

export interface CountryPaymentTermsFile {
  /** ISO 3166-1 alpha-2, uppercase, must match the file's own name (`countries/data/all.ts` checks it). */
  countryCode: string;
  /** Longest agreed term in calendar days after the issue date ("net"). */
  maxNetDays?: number;
  /** Longest agreed term in days after the issue date when it is counted to the end of that month. */
  maxEndOfMonthDays?: number;
  /** Source of the two caps above. */
  provenance?: PolicyProvenance;
  defaultTerm?: CountryDefaultPaymentTerm;
  notes?: string;
}

export class InvalidPaymentTermsError extends InvalidPolicyProvenanceError {}

function assertPositiveInteger(value: unknown, field: string, context: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new InvalidPaymentTermsError(`${context}: "${field}" must be a positive integer.`);
  }
}

export function hasPaymentTermCap(file: CountryPaymentTermsFile): boolean {
  return (
    file.maxNetDays !== undefined || file.maxEndOfMonthDays !== undefined || file.provenance !== undefined
  );
}

export function assertValidPaymentTerms(file: CountryPaymentTermsFile, context: string): void {
  if (!hasPaymentTermCap(file) && !file.defaultTerm) {
    throw new InvalidPaymentTermsError(`${context}: declares neither a payment-term cap nor a default term.`);
  }
  if (hasPaymentTermCap(file)) {
    assertPositiveInteger(file.maxNetDays, 'maxNetDays', context);
    assertPositiveInteger(file.maxEndOfMonthDays, 'maxEndOfMonthDays', context);
    assertValidPolicyProvenance(
      file.provenance as PolicyProvenance,
      `${context} paymentTerms`,
      'a payment-term cap',
    );
  }
  if (file.defaultTerm) {
    assertPositiveInteger(file.defaultTerm.days, 'defaultTerm.days', context);
    assertValidPolicyProvenance(
      file.defaultTerm.provenance,
      `${context} paymentTerms.defaultTerm`,
      'a default payment term',
    );
  }
}
