import { SUGGESTED_UNIT_CODES, SUGGESTED_UNIT_LABELS } from '../formats/semantic/unit-code';
import { DocumentFieldDescriptor } from './types';

export interface DocumentLineOptions {
  /** Whether designation, quantity and unit price must be filled: false for supplier data read off a
   *  received document, where any of them may be missing. */
  required: boolean;
  /** VAT rate on every line: required on an invoice and a credit note (Directive 2006/112/EC art.
   *  226(9) and (10)), optional on a quote. */
  vatRateRequired: boolean;
  /** Offer the company's own VAT rate catalog; a supplier's rate may be foreign. */
  vatRateCatalog: boolean;
  /** Per-type wording, merged onto the shared field of the same key. */
  overrides?: Record<string, Partial<DocumentFieldDescriptor>>;
}

export const DOCUMENT_LINE_PREFILL: NonNullable<DocumentFieldDescriptor['prefillFrom']> = {
  entity: 'article',
  map: { articleId: 'id', description: 'name', unitPrice: 'unitPrice', vatRate: 'vatRate' },
};

/** The line shape every quote, invoice, credit note and received invoice shares, so a line moves from
 *  one document to the next without losing a field. */
export function documentLineFields(options: DocumentLineOptions): DocumentFieldDescriptor[] {
  const { required, vatRateRequired, vatRateCatalog, overrides = {} } = options;
  const fields: DocumentFieldDescriptor[] = [
    { key: 'description', kind: 'text', label: 'Designation', required },
    { key: 'articleId', kind: 'hiddenReference', label: 'Article', required: false, entity: 'article' },
    { key: 'quantity', kind: 'number', label: 'Quantity', required, min: 0 },
    {
      key: 'unit',
      kind: 'text',
      label: 'Unit',
      required: false,
      helpText: 'How the quantity is counted. Pick a unit or type your own.',
      suggestedValues: SUGGESTED_UNIT_CODES.map((value) => ({ value, label: SUGGESTED_UNIT_LABELS[value] })),
    },
    { key: 'unitPrice', kind: 'money', label: 'Unit price', required, min: 0, currencyField: 'currency' },
    {
      key: 'vatRate',
      kind: 'select',
      label: 'VAT rate',
      required: vatRateRequired,
      options: [],
      allowCustomValue: true,
      ...(vatRateCatalog ? { usesVatRateCatalog: true } : {}),
      helpText: 'The VAT rate that applies to this line.',
    },
    {
      key: 'discountPercent',
      kind: 'number',
      label: 'Discount %',
      required: false,
      min: 0,
      max: 100,
      helpText: 'Percentage discount applied to this line, before VAT.',
    },
    {
      key: 'date',
      kind: 'date',
      label: 'Work date',
      required: false,
      hideWhenEmpty: true,
      helpText: 'When the work on this line was done, if it differs from the document date.',
    },
  ];
  return fields.map((field) => ({ ...field, ...overrides[field.key] }));
}
