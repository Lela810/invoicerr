export {}; // makes this spec a module, not a global script -- see tsconfig.json

/**
 * A draft invoice is deleted from its list row or its own page, and only once the confirmation dialog
 * is accepted.
 */
const api = Cypress.env("apiUrl");

function createDraftInvoice(): Cypress.Chainable<string> {
	return cy
		.request({ url: `${api}/api/documents/references/client/search` })
		.its("body")
		.then((clients: { id: string }[]) => {
			expect(clients, "the seed has a client").to.have.length.greaterThan(0);
			return cy
				.request({
					method: "POST",
					url: `${api}/api/documents/types/invoice/actions/save-draft`,
					body: {
						data: {
							client: clients[0].id,
							issueDate: "2026-08-15",
							dueDate: "2026-09-15",
							currency: "EUR",
							lines: [{ description: "Draft to delete", quantity: 1, unit: "unit", unitPrice: 100, vatRate: "20" }],
						},
					},
				})
				.then((saved) => saved.body.document.id as string);
		});
}

describe("Deleting a draft", () => {
	before(() => {
		cy.resetAndSeed();
	});

	beforeEach(() => {
		cy.login();
	});

	it("deletes a draft invoice from its row, after the confirmation", () => {
		createDraftInvoice().then((invoiceId) => {
			cy.visit("/documents/invoice");
			cy.openDocumentRowMenu(invoiceId);
			cy.get(`[data-cy="document-row-action-delete-${invoiceId}"]`).click();

			const dialog = `document-row-delete-confirm-${invoiceId}`;
			cy.get(`[data-cy="${dialog}"]`).should("be.visible");
			// Nothing is removed before the user confirms.
			cy.request({ url: `${api}/api/documents/${invoiceId}?typeId=invoice` }).its("status").should("eq", 200);

			cy.intercept("POST", `${api}/api/documents/types/invoice/actions/delete`).as("delete");
			cy.get(`[data-cy="${dialog}-confirm"]`).click();
			cy.wait("@delete").its("response.statusCode").should("be.oneOf", [200, 201]);

			cy.get(`[data-cy="document-list-row-${invoiceId}"]`).should("not.exist");
			cy.request({ url: `${api}/api/documents/${invoiceId}?typeId=invoice`, failOnStatusCode: false })
				.its("status")
				.should("eq", 404);
		});
	});

	it("deletes a draft invoice from its own page, after the confirmation, and returns to the list", () => {
		createDraftInvoice().then((invoiceId) => {
			cy.visit("/documents/invoice");
			cy.openDocument(invoiceId);
			cy.openDocumentActionsMenu();
			cy.get('[data-cy="document-action-delete"]').click();

			cy.get('[data-cy="document-detail-delete-confirm"]').should("be.visible");
			cy.intercept("POST", `${api}/api/documents/types/invoice/actions/delete`).as("delete");
			cy.get('[data-cy="document-detail-delete-confirm-confirm"]').click();
			cy.wait("@delete").its("response.statusCode").should("be.oneOf", [200, 201]);

			cy.location("pathname").should("eq", "/documents/invoice");
			cy.request({ url: `${api}/api/documents/${invoiceId}?typeId=invoice`, failOnStatusCode: false })
				.its("status")
				.should("eq", 404);
		});
	});
});
