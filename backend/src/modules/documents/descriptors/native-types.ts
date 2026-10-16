import { buildCreditNoteDescriptor } from './credit-note.descriptor';
import { buildExpenseDescriptor } from './expense.descriptor';
import { buildGoodsReceiptDescriptor } from './goods-receipt.descriptor';
import { buildInvoiceDescriptor } from './invoice.descriptor';
import { buildPurchaseOrderDescriptor } from './purchase-order.descriptor';
import { buildQuoteDescriptor } from './quote.descriptor';
import { buildReceivedInvoiceDescriptor } from './received-invoice.descriptor';
import { DocumentTypeDescriptor } from './types';

/** Every document type this application ships, in registration order. */
export function buildNativeDocumentTypeDescriptors(): DocumentTypeDescriptor[] {
  return [
    buildQuoteDescriptor(),
    buildInvoiceDescriptor(),
    buildCreditNoteDescriptor(),
    buildExpenseDescriptor(),
    buildReceivedInvoiceDescriptor(),
    buildPurchaseOrderDescriptor(),
    buildGoodsReceiptDescriptor(),
  ];
}
