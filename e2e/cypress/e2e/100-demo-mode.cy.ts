export {}; // makes this spec a module, not a global script -- see tsconfig.json

// Issue #533: this spec runs against a stack with DEMO_MODE=true and a dataset built by
// `npm run demo:reset`. It does NOT call `cy.resetAndSeed()` (the shared `before()` hook in
// `support/e2e.ts`, opted out of here exactly the way `01-register.cy.ts` does): that helper signs
// up a fresh user through `POST /api/auth/sign-up/email`, which demo mode refuses outright
// (`lib/registration-policy.ts`). This spec's whole point is to run against the ONE seeded demo
// account instead, never to create its own.
Cypress.env("skipSeed", true);

const api = Cypress.env("apiUrl");

const DEMO_EMAIL = "demo@invoicerr.app";
const DEMO_PASSWORD = "demo";

function signInAsDemo() {
	cy.visit("/auth/sign-in");
	cy.get('[data-cy="auth-email-input"]').type(DEMO_EMAIL);
	cy.get('[data-cy="auth-password-input"]').type(DEMO_PASSWORD);
	cy.get('[data-cy="auth-submit-btn"]').click();
	cy.url({ timeout: 20000 }).should("include", "/dashboard");
}

describe("Demo mode (issue #533)", () => {
	it("shows the demo credentials on the sign-in page", () => {
		cy.visit("/auth/sign-in");
		cy.get('[data-cy="demo-credentials-notice"]', { timeout: 10000 }).should(
			"be.visible",
		);
		cy.get('[data-cy="demo-credentials-notice"]').should(
			"contain.text",
			"demo@invoicerr.app",
		);
	});

	it("hides the sign-up link, since the server says sign-up is closed", () => {
		// A conditional 304 carries no body to assert on: always ask for a fresh answer.
		cy.intercept("GET", "**/api/invitations/can-register*", (req) => {
			delete req.headers["if-none-match"];
		}).as("canRegister");
		cy.visit("/auth/sign-in");
		cy.wait("@canRegister")
			.its("response.body")
			.should("include", { allowed: false, requiresCode: false });
		cy.get('[data-cy="auth-signup-link"]').should("not.exist");
	});

	it("shows a pending invoice at the same VAT-inclusive amount on the dashboard and in the list", () => {
		signInAsDemo();
		cy.request<
			Array<{
				id: string;
				items?: Array<{ id: string; amount?: { value: number } }>;
			}>
		>(`${api}/api/documents/dashboard`).then(({ body: widgets }) => {
			const pending = widgets.find((widget) => widget.id === "invoice:pending");
			const item = pending?.items?.[0];
			expect(item?.amount, "a seeded pending invoice with an amount").to.exist;
			const amount = item!.amount!.value.toFixed(2);

			cy.get('[data-cy="widget-invoice:pending-basis"]', {
				timeout: 20000,
			}).should("contain.text", "incl. VAT");
			cy.get(`[data-cy="widget-item-${item!.id}"]`).should(
				"contain.text",
				amount,
			);

			cy.visit("/documents/invoice");
			cy.get(`[data-cy="document-row-amount-${item!.id}"]`, { timeout: 20000 })
				.should("contain.text", amount)
				.and("contain.text", "incl. VAT");
		});
	});

	it("leaves no seeded invoice with an excess, and settles one by a credited line plus a payment", () => {
		signInAsDemo();
		// Not every country has a credit note, so every demo company is checked, never just the active one.
		cy.request<{ companies: Array<{ id: string }> }>(
			`${api}/api/auth/get-session`,
		)
			.its("body.companies")
			.then((companies: Array<{ id: string }>) => {
				const credited: Array<{ companyId: string; invoiceId: string }> = [];
				cy.wrap(companies)
					.each((company: { id: string }) => {
						cy.request("POST", `${api}/api/companies/switch`, {
							companyId: company.id,
						});
						cy.request<{ items: Array<{ id: string }> }>(
							`${api}/api/documents?typeId=invoice&page=1&pageSize=50`,
						)
							.its("body.items")
							.each((invoice: { id: string }) => {
								cy.request<{
									credits: unknown[];
									settlement: { excessMinor: number; settled: boolean };
								}>(
									`${api}/api/documents/${invoice.id}/settlement?typeId=invoice`,
								).then(({ body }) => {
									expect(
										body.settlement.excessMinor,
										`excess on ${invoice.id}`,
									).to.eq(0);
									if (body.credits.length > 0) {
										expect(body.settlement.settled).to.eq(true);
										credited.push({
											companyId: company.id,
											invoiceId: invoice.id,
										});
									}
								});
							});
					})
					.then(() => {
						expect(
							credited,
							"a credited invoice in each company that has credit notes",
						).not.to.be.empty;
						cy.request("POST", `${api}/api/companies/switch`, {
							companyId: credited[0].companyId,
						});
						cy.visit(`/documents/invoice/${credited[0].invoiceId}`);
						cy.get('[data-cy="document-settlement-credited"]', {
							timeout: 20000,
						}).should("exist");
						cy.get('[data-cy="document-settlement-excess"]').should(
							"not.exist",
						);
					});
			});
	});

	it("signs in with the demo account and shows the demo banner on every authenticated page", () => {
		signInAsDemo();
		cy.get('[data-cy="demo-banner"]', { timeout: 10000 }).should("be.visible");
		cy.get('[data-cy="demo-banner"]').should(
			"contain.text",
			"resets every 4 hours",
		);

		// The banner is not a per-page fluke of the dashboard: it is mounted once, for the whole
		// authenticated shell.
		cy.visit("/documents/invoice");
		cy.get('[data-cy="demo-banner"]', { timeout: 10000 }).should("be.visible");
	});

	it("refuses to change the demo account password, in the UI and on the server", () => {
		signInAsDemo();
		cy.visit("/account/security");
		cy.get('[data-cy="account-security-current-password-input"]').type(
			DEMO_PASSWORD,
		);
		cy.get('[data-cy="account-security-password-input"]').type(
			"SomeOtherPassword123!",
		);
		cy.get('[data-cy="account-security-confirm-password-input"]').type(
			"SomeOtherPassword123!",
		);
		cy.get('[data-cy="account-security-submit-button"]').should("be.disabled");
	});

	it("refuses to delete the demo account in the UI", () => {
		signInAsDemo();
		cy.visit("/account/danger");
		cy.get('[data-cy="account-danger-delete-button"]').should("be.disabled");
	});

	// The one behaviour this spec BREAKS and RESTORES for real (see the PR body / CLOUD_PROMPT
	// report for the actual break-and-restore command output): a draft invoice's "Send" is
	// refused by the backend at the transport chokepoint (`TransportRegistry.register`,
	// `modules/demo/demo-blocked.ts`), surfacing as "Send failed" with a named reason, never a
	// silent success.
	it('refuses to send a document: a draft invoice ends "Send failed" with the demo reason, never a silent success', () => {
		signInAsDemo();
		cy.visit("/documents/invoice");
		cy.contains(/^draft$/i, { timeout: 10000 }).should("be.visible");

		// The one draft row's own "Send" button, found by text (like 13-api-keys.cy.ts's own
		// create-button selector): this action has no stable per-test data-cy (its id is a fresh
		// document id every seed), so it is found by its visible label instead.
		cy.contains("button", /^send$/i, { timeout: 10000 }).click();
		// The confirmation dialog can render below the small default Cypress viewport, so
		// `scrollIntoView()` first, the same fix `13-api-keys.cy.ts` already uses for an
		// analogous "appeared but is outside the current scroll position" case.
		cy.contains("button", /^confirm$/i, { timeout: 10000 })
			.scrollIntoView()
			.click();

		// The row itself is the real "did this stay blocked" signal: its status badge is the
		// guarantee that a send never silently succeeds. Found by text, like the "Send"/"Confirm"
		// buttons above: this status has no stable per-test data-cy either.
		//
		// Issue #570, twice over. First pass: the error paragraph below was asserted `be.visible`
		// while clipped by its own `line-clamp-2`. Second pass (this one): moving the assertion to
		// the status badge was not enough on its own -- CI (never reproduced locally across more
		// than a dozen runs under Firefox) still failed here, same "clipped by ... overflow: hidden,
		// clip, scroll or auto" message, now on the BADGE. Root cause is Cypress's own
		// `scrollBehavior: "top"` (the config default, unchanged here): clicking "Send" above
		// scrolls that button to the very top of the scrollable content pane while the row is still
		// short (pre-send: no number, no error line yet). Once the send fails and the row grows
		// (gains its number, then the two-line error paragraph), that earlier scroll position can
		// leave the badge outside the viewport -- the exact mechanism PR #572 already hit and fixed
		// on spec 112's "declares the last number issued" test the same way. This is a scroll
		// artifact of the click, not a rendering bug: the row itself never overflows or truncates
		// anything a real user would see (confirmed against the CI failure's own screenshot -- nothing
		// is visually clipped, the page is simply scrolled to a different part of a normal list), so
		// `scrollIntoView()` first, then assert existence and TEXT rather than Cypress's
		// layout/scroll-dependent visibility, exactly like the error paragraph below already does.
		cy.contains('[data-cy="document-status-badge"]', /^send failed$/i, {
			timeout: 20000,
		})
			.scrollIntoView()
			.should("exist")
			.and("contain.text", "Send failed");

		// The unique, load-bearing assertion: this exact refusal text only ever comes from
		// `DemoModeBlockedError` (`modules/demo/demo-blocked.ts`). `/send failed/i` alone is
		// ambiguous (it also names the list's OWN status filter tab), so the specific reason is
		// what this test actually pins down. The error paragraph itself is `line-clamp-2` inside an
		// `overflow: hidden` row, and sits below the badge checked above -- the same scroll-position
		// reasoning applies, so this is scrolled into view and read by TEXT too, never by Cypress
		// visibility. The row id in its own data-cy is a fresh document id every seed (same reason
		// the "Send" button above is found by text), so the error paragraph is found by a prefix
		// match instead.
		cy.get('[data-cy^="document-row-last-error-"]', { timeout: 20000 })
			.scrollIntoView()
			.should("exist")
			.and("contain.text", "is disabled in this demo");
		// Never the ordinary "no transport configured" refusal a company with none chosen would
		// see: this specific company DOES have one (`invoiceTransportId: 'email'`, seeded by
		// `seed-company.ts`), so the ONLY reason it can fail is demo mode itself.
		cy.contains(/no transport is configured/i).should("not.exist");
	});

	it('refuses to send the seeded draft credit note: it ends "Send failed" with the demo reason, never "Sent"', () => {
		signInAsDemo();
		cy.request<{ items: Array<{ id: string; status: string }> }>(
			`${api}/api/documents?typeId=credit-note&page=1&pageSize=50`,
		)
			.its("body.items")
			.then((items: Array<{ id: string; status: string }>) => {
				const draft = items.find((item) => item.status === "draft");
				expect(draft, "a seeded draft credit note").to.exist;
				const id = draft!.id;

				cy.visit("/documents/credit-note");
				cy.runDocumentRowAction(id, "send");

				cy.get(`[data-cy="document-list-row-${id}"]`, { timeout: 20000 })
					.find('[data-cy="document-status-badge"]', { timeout: 20000 })
					.should("contain.text", "Send failed");
				cy.get(`[data-cy="document-row-last-error-${id}"]`)
					.should("exist")
					.and("contain.text", "is disabled in this demo");
				cy.request(`${api}/api/documents/${id}?typeId=credit-note`)
					.its("body.status")
					.should("eq", "send_failed");
			});
	});

	it('refuses to send a credit note that corrects no invoice: it stays a draft, never "Sent"', () => {
		signInAsDemo();
		cy.request(`${api}/api/documents/types/credit-note`)
			.its("body.fields")
			.then(
				(
					fields: {
						key: string;
						fields?: { key: string; options?: { value: string }[] }[];
					}[],
				) => {
					const vatRate = fields
						.find((f) => f.key === "lines")
						?.fields?.find((f) => f.key === "vatRate")?.options?.[0]?.value;
					expect(vatRate, "the active company has a VAT rate").to.be.a("string");

					cy.request({
						method: "POST",
						url: `${api}/api/documents/types/credit-note/actions/save-draft`,
						body: {
							data: {
								issueDate: new Date().toISOString().slice(0, 10),
								currency: "EUR",
								reason: "Pricing correction agreed with the client.",
								lines: [
									{
										description: "Consulting day",
										quantity: 1,
										unit: "unit",
										unitPrice: 100,
										vatRate,
									},
								],
							},
						},
					}).then((saved) => {
						const id = saved.body.document.id as string;

						cy.intercept("POST", "**/api/documents/types/credit-note/actions/send").as(
							"send",
						);
						cy.visit("/documents/credit-note");
						cy.runDocumentRowAction(id, "send");

						cy.wait("@send").its("response.statusCode").should("eq", 400);
						cy.contains(/no client to send it to/i, { timeout: 10000 }).should(
							"exist",
						);
						cy.get(`[data-cy="document-list-row-${id}"]`)
							.find('[data-cy="document-status-badge"]')
							.should("contain.text", "Draft");
						cy.request(`${api}/api/documents/${id}?typeId=credit-note`)
							.its("body")
							.then((doc: { status: string; number: number | null }) => {
								expect(doc.status, "still a draft, never sent").to.eq("draft");
								expect(doc.number, "no number spent").to.eq(null);
							});
					});
				},
			);
	});

	// Issue #581 - "Validate" never reaches a DEMO_MODE chokepoint (it is a plain Postgres write,
	// never `TransportRegistry.register`'s own wrap) UNLESS a country channel mandate routes it
	// through the real send, the same branch "Send" itself always takes - see
	// `invoice-actions.ts`'s own "validate" registration. This invoice's `issueDate` is picked far
	// before ANY shipped mandate's own threshold (France's own, the earliest, starts 2026-09-01) so
	// this test proves the ORDINARY branch, never the mandated one 118-invoice-validate.cy.ts already
	// covers in full against a real (non-demo) stack.
	it("Validate succeeds in demo mode while Send is still refused - numbering is a Postgres write, never an outbound chokepoint", () => {
		signInAsDemo();

		cy.request({ url: `${api}/api/documents/references/client/search` })
			.its("body")
			.then((clients: { id: string }[]) => {
				expect(
					clients,
					"le compte démo a au moins un client",
				).to.have.length.greaterThan(0);

				// The demo account's ACTIVE company is whichever of the six seeded ones
				// (DE/DZ/FR/IT/PL/PT) `npm run demo:reset` happened to create last - never assumed
				// here. Its own VAT rate catalog is read from the merged invoice descriptor
				// (`usesVatRateCatalog`, company-view.ts) rather than a hardcoded "20" (France's own
				// rate, which a non-French demo company's own catalog refuses).
				cy.request({ url: `${api}/api/documents/types/invoice` })
					.its("body.fields")
					.then(
						(
							fields: {
								key: string;
								fields?: { key: string; options?: { value: string }[] }[];
							}[],
						) => {
							const linesField = fields.find((f) => f.key === "lines");
							const vatRateField = linesField?.fields?.find(
								(f) => f.key === "vatRate",
							);
							const vatRate = vatRateField?.options?.[0]?.value;
							expect(
								vatRate,
								"le catalogue de TVA de l'entreprise active a au moins un taux",
							).to.be.a("string");

							cy.request({
								method: "POST",
								url: `${api}/api/documents/types/invoice/actions/save-draft`,
								body: {
									data: {
										client: clients[0].id,
										issueDate: "2024-01-15",
										dueDate: "2024-02-15",
										currency: "EUR",
										lines: [
											{
												description: "Conseil",
												quantity: 1,
												unit: "unit",
												unitPrice: 200,
												vatRate,
											},
										],
									},
									failOnStatusCode: false,
								},
							}).then((saved) => {
								expect(saved.status, "brouillon de facture créé").to.be.oneOf([
									200, 201,
								]);
								const invoiceId = saved.body?.document?.id as string;
								expect(invoiceId, "le brouillon a un identifiant").to.be.a(
									"string",
								);

								cy.visit("/documents/invoice");
								cy.runDocumentRowAction(invoiceId, "validate");

								// Succeeds for real - numbered and locked, never blocked by demo mode.
								cy.get(`[data-cy="document-list-row-${invoiceId}"]`, {
									timeout: 15000,
								})
									.find('[data-cy="document-status-badge"]')
									.should("contain.text", "Validated");
								cy.request({
									url: `${api}/api/documents/${invoiceId}?typeId=invoice`,
								})
									.its("body")
									.then((doc) => {
										expect(
											doc.status,
											"réellement validated en base, jamais bloqué",
										).to.eq("validated");
										expect(doc.number, "un numéro a bien été attribué").to.be.a(
											"number",
										);
									});

								// "Send" on this SAME, now-validated invoice is still refused - the exact
								// same chokepoint the test above already proves, now reached from
								// "validated" rather than "draft" (SEND_TRANSITIONS's own widened `from`,
								// issue #581).
								cy.runDocumentRowAction(invoiceId, "send");
								cy.get(`[data-cy="document-list-row-${invoiceId}"]`, {
									timeout: 20000,
								})
									.find('[data-cy="document-status-badge"]', { timeout: 20000 })
									.should("contain.text", "Send failed");
								cy.get(`[data-cy="document-row-last-error-${invoiceId}"]`)
									.should("exist")
									.and("contain.text", "is disabled in this demo");

								// Never re-numbered by the refused send attempt.
								cy.request({
									url: `${api}/api/documents/${invoiceId}?typeId=invoice`,
								})
									.its("body.number")
									.should("be.a", "number");
							});
						},
					);
			});
	});
});
