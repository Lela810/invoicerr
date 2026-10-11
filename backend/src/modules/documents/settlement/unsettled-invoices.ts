import { DocumentInstanceResult } from '../actions/action-registry';
import { DocumentTypeDescriptor } from '../descriptors/types';
import { computeDocumentTotals } from '../totals/compute-totals';
import { DocumentSettlement, computeSettlement } from './compute-settlement';
import { creditsForInvoiceFromNotes, listCreditNotes, toSettlementCreditInputs } from './credits';
import { sumPaidMinorByDocument } from './payments';

/**
 * The "sent/imported AND not settled" predicate that both invoice-contributions.ts's "pending
 * invoices" dashboard tile and `GET /documents`'s own `settlement=unsettled` list filter
 * (list-documents.dto.ts, documents.service.ts) apply. Extracted here, out of
 * invoice-contributions.ts (where it was born), so a metric tile promising "click through to see
 * these" and the list behind that click can never independently drift on what "pending" means. A
 * "draft" is never pending (not yet issued), a "cancelled" invoice is excluded for free (a plain `in`
 * list, never a "not draft" negation, see invoice-contributions.ts's own header for why that
 * matters), and a "sent"/"imported" invoice already fully paid and/or credited
 * (`settlement/compute-settlement.ts`, `settlement/credits.ts`) is settled, not pending. "imported"
 * (issue #340) is included deliberately: recording a payment is one of the few actions the owner's
 * own decision allows on it, and a payment nobody can ever chase because the invoice never shows up
 * as pending would make that allowance hollow.
 *
 * Runs the same two extra reads invoice-contributions.ts always has, batched once for every candidate
 * invoice (never one query per document): `sumPaidMinorByDocument` and `listCreditNotes`.
 */
export async function filterUnsettledInvoices(
  companyId: string,
  invoiceDescriptor: DocumentTypeDescriptor,
  invoices: readonly DocumentInstanceResult[],
): Promise<DocumentInstanceResult[]> {
  const balances = await resolveUnsettledInvoiceBalances(companyId, invoiceDescriptor, invoices);
  return balances.map((balance) => balance.invoice);
}

/** One invoice's totals and settlement, the same figures its settlement screen shows. */
export interface InvoiceBalance {
  invoice: DocumentInstanceResult;
  netMinor: number;
  grossMinor: number;
  settlement: DocumentSettlement;
}

/** `filterUnsettledInvoices`, keeping each invoice's balance for callers that total what is owed. */
export async function resolveUnsettledInvoiceBalances(
  companyId: string,
  invoiceDescriptor: DocumentTypeDescriptor,
  invoices: readonly DocumentInstanceResult[],
): Promise<InvoiceBalance[]> {
  const sentInvoices = invoices.filter(isIssuedInvoice);
  const balances = await resolveInvoiceBalances(companyId, invoiceDescriptor, sentInvoices);
  return balances.filter((balance) => !balance.settlement.settled);
}

/** Payments and credit notes are read once for the whole batch, never once per invoice. */
export async function resolveInvoiceBalances(
  companyId: string,
  invoiceDescriptor: DocumentTypeDescriptor,
  invoices: readonly DocumentInstanceResult[],
): Promise<InvoiceBalance[]> {
  const paidMinorByDocument = await sumPaidMinorByDocument(
    companyId,
    invoices.map((invoice) => invoice.id),
  );
  const creditNotes = await listCreditNotes(companyId);

  return invoices.map((invoice) => {
    const data = (invoice.data ?? {}) as Record<string, unknown>;
    const { netMinor, grossMinor } = computeDocumentTotals(invoiceDescriptor, data);
    const paidMinor = paidMinorByDocument.get(invoice.id) ?? 0;
    const { credits } = creditsForInvoiceFromNotes(creditNotes, invoice.id, invoiceDescriptor, data);
    const settlement = computeSettlement(
      grossMinor,
      [{ amountMinor: paidMinor }],
      toSettlementCreditInputs(credits),
    );
    return { invoice, netMinor, grossMinor, settlement };
  });
}

export function isIssuedInvoice(invoice: DocumentInstanceResult): boolean {
  return invoice.status === 'sent' || invoice.status === 'imported';
}

/**
 * `dueDate < today` (UTC, compared as `YYYY-MM-DD` strings, same clock convention as
 * invoice-contributions.ts's own `monthKey`) on an ALREADY-unsettled invoice: the "overdue" half of
 * `filterUnsettledInvoices` above, shared because the "Overdue invoices" tile and `settlement=overdue`
 * must apply exactly the same rule. Takes `todayIso` rather than reading the clock itself so a caller
 * filtering many invoices computes "today" once, not once per row.
 */
export function isOverdueInvoice(invoice: DocumentInstanceResult, todayIso: string): boolean {
  const data = (invoice.data ?? {}) as Record<string, unknown>;
  const dueDate = typeof data.dueDate === 'string' ? data.dueDate.slice(0, 10) : '';
  return dueDate !== '' && dueDate < todayIso;
}
