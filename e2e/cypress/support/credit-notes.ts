import { FRENCH_BUYER_IDENTIFIERS } from "../fixtures/identifiers";

/** Before France's e-invoicing mandate date, so an invoice and a credit note can still go by email. */
export const PRE_MANDATE_DATE = "2026-08-31";

export interface SentInvoice {
	invoiceId: string;
	rowIds: string[];
}

function api(): string {
	return Cypress.env("apiUrl");
}

function sendAndWait(typeId: string, id: string, data: Record<string, unknown>) {
	cy.request({
		method: "POST",
		url: `${api()}/api/documents/types/${typeId}/actions/send`,
		body: { documentId: id, data },
	})
		.its("status")
		.should("be.oneOf", [200, 201]);
	cy.waitForDocumentStatus(`${api()}/api/documents/${id}?typeId=${typeId}`, ["sent"]);
}

/** An invoice already sent, with the row ids a credit note's `correctedLines` points at. */
export function sentInvoice(invoiceId: string): Cypress.Chainable<SentInvoice> {
	return cy.request(`${api()}/api/documents/${invoiceId}?typeId=invoice`).then((invoice) => ({
		invoiceId,
		rowIds: (invoice.body.data.lines as { $rowId: string }[]).map((line) => line.$rowId),
	}));
}

/** An invoice (two lines by default) sent by email to a client of its own: what a credit note corrects. */
export function sendInvoiceToCredit(
	label: string,
	lines: Record<string, unknown>[] = [
		{ description: `Corrected ${label}`, quantity: 1, unit: "unit", unitPrice: 42, vatRate: "20" },
		{ description: `Kept ${label}`, quantity: 1, unit: "unit", unitPrice: 58, vatRate: "20" },
	],
): Cypress.Chainable<SentInvoice> {
	cy.request({ method: "POST", url: `${api()}/api/company/info`, body: { invoiceTransportId: "email" } })
		.its("status")
		.should("be.oneOf", [200, 201]);
	return cy
		.request({
			method: "POST",
			url: `${api()}/api/clients`,
			body: {
				name: `Credited client ${label}`,
				contactEmail: `credited-${label}-${Date.now()}@example.com`,
				currency: "EUR",
				country: "France",
				countryCode: "FR",
				address: "1 Rue de l'Avoir",
				city: "Paris",
				postalCode: "75001",
				isActive: true,
				type: "COMPANY",
				identifiers: FRENCH_BUYER_IDENTIFIERS,
			},
		})
		.then((client) => {
			const data = {
				client: client.body.id as string,
				issueDate: PRE_MANDATE_DATE,
				dueDate: "2026-09-30",
				currency: "EUR",
				lines,
			};
			return cy
				.request({ method: "POST", url: `${api()}/api/documents/types/invoice/actions/save-draft`, body: { data } })
				.then((saved) => {
					const invoiceId = saved.body.document.id as string;
					sendAndWait("invoice", invoiceId, saved.body.document.data);
					return sentInvoice(invoiceId);
				});
		});
}

/** A credit note correcting the first line of `invoice`, issued (draft, sending, sent) through the API. */
export function issueCreditNoteFor(
	invoice: SentInvoice,
	overrides: Record<string, unknown> = {},
): Cypress.Chainable<string> {
	return cy
		.request({
			method: "POST",
			url: `${api()}/api/documents/types/credit-note/actions/save-draft`,
			body: {
				data: {
					invoice: invoice.invoiceId,
					correctedLines: [invoice.rowIds[0]],
					issueDate: PRE_MANDATE_DATE,
					currency: "EUR",
					reason: "Line refunded.",
					...overrides,
				},
			},
		})
		.then((saved) => {
			const id = saved.body.document.id as string;
			expect(saved.body.document.displayNumber, "a draft carries no number").to.be.oneOf([null, undefined]);
			sendAndWait("credit-note", id, saved.body.document.data);
			return cy.wrap(id);
		});
}

/** Sends a fresh invoice, then issues a credit note correcting it. */
export function issueCreditNote(label: string): Cypress.Chainable<string> {
	return sendInvoiceToCredit(label).then((invoice) => issueCreditNoteFor(invoice));
}
