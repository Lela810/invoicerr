export {}; // makes this spec a module, not a global script -- see tsconfig.json

/**
 * PR #473 review point 2 - "a credit note must never decrement stock".
 *
 * Credit notes are numbered at issuance, so `applyStockOnIssuance` runs for them the same way it does
 * for an invoice. It acts only on what the document type declares (`stock/apply-stock-on-issuance.ts
 * #declaresArticleReference`), and a credit note declares no article reference: issuing one that
 * corrects a stock-tracked invoice line leaves the stock where the invoice's own issuance put it.
 */
import { issueCreditNoteFor, sendInvoiceToCredit } from "../support/credit-notes";

const api = Cypress.env("apiUrl");

function createTrackedArticle() {
	return cy
		.request({
			method: "POST",
			url: `${api}/api/articles`,
			body: { name: "Widget crédité", unitPrice: 100, vatRate: 20, quantity: 10, lowStockThreshold: 3 },
		})
		.then((res) => {
			expect(res.status, "article created").to.be.oneOf([200, 201]);
			expect(res.body.quantity, "initial stock").to.eq(10);
			return res.body.id as string;
		});
}

describe('PR #473 review point 2 - a credit note with an articleId on its line never decrements stock', () => {
	before(() => {
		cy.resetAndSeed();
	});

	beforeEach(() => {
		cy.login();
	});

	it("issuing a credit note that corrects a stock-tracked invoice line leaves the article's stock where the invoice put it", () => {
		createTrackedArticle().then((articleId) => {
			sendInvoiceToCredit("473-stock", [
				{ articleId, description: "Widget crédité", quantity: 4, unit: "unit", unitPrice: 100, vatRate: "20" },
			]).then((invoice) => {
				// The invoice's own issuance decrements once: 10 - 4.
				cy.request({ url: `${api}/api/articles/${articleId}` })
					.its("body.quantity")
					.should("eq", 6);

				issueCreditNoteFor(invoice).then((creditNoteId) => {
					cy.request({ url: `${api}/api/documents/${creditNoteId}?typeId=credit-note` })
						.its("body")
						.then((doc) => {
							expect(doc.status, "issued").to.eq("sent");
							expect(doc.displayNumber, "numbered like every credit note").to.eq("CN-2026-0001");
						});

					// Never moved by the credit note, whatever line it corrects.
					cy.request({ url: `${api}/api/articles/${articleId}` })
						.its("body.quantity")
						.should("eq", 6);
				});
			});
		});
	});
});
