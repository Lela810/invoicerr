// Everything the measurement holds fixed so that two runs are comparable: the seed's size, how many
// samples each route gets, and how a route's parameters are filled. Read by node (seed, plan) and by
// k6 (latency.js), so it stays plain data with no runtime import.

export const SEED = {
  clients: 25,
  articles: 15,
  quotes: 120,
  draftInvoices: 200,
  sentInvoices: 25,
};

// One warm-up pass, unrecorded, then this many recorded passes over every GET route. A route whose
// warm-up request took longer than SLOW_ROUTE_MS gets SLOW_ROUTE_PASSES instead, so one slow export
// does not decide the length of the whole run.
export const GET_PASSES = 60;
export const SLOW_ROUTE_MS = 1000;
export const SLOW_ROUTE_PASSES = 10;
export const SCENARIO_ITERATIONS = 20;

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getUTCFullYear()}-01-01`;

// `<previous segment>/{param}` first, then `{param}` alone.
export const PATH_PARAMS = {
  'articles/{id}': (c) => c.ids.article,
  'clients/{id}': (c) => c.ids.client,
  'clients/{clientId}': (c) => c.ids.client,
  'projects/{id}': (c) => c.ids.project,
  'webhooks/{id}': (c) => c.ids.webhook,
  'documents/{id}': (c) => c.ids.sentInvoice,
  'payments/{documentId}': (c) => c.ids.sentInvoice,
  'documents/{token}': (c) => c.ids.shareToken,
  'types/{typeId}': () => 'invoice',
  'actions/{actionId}': () => 'send',
  'formats/{syntax}': () => 'cii',
  'references/{entity}': () => 'client',
  '{entity}/{refId}': (c) => c.ids.client,
  'country-readiness/{countryCode}': (c) => c.countryCode,
  'capabilities/{countryCode}': (c) => c.countryCode,
};

export const QUERY_VALUES = {
  typeId: () => 'invoice',
  page: () => '1',
  pageSize: () => '25',
  q: () => 'Client',
  query: () => 'Client',
  email: (c) => c.email,
  countryCode: (c) => c.countryCode,
  partyType: () => 'COMPANY',
  from: yearStart,
  to: today,
  target: () => 'DOCUMENT',
};

// Optional query parameters sent anyway, because the app always sends them.
export const OPTIONAL_QUERY = ['typeId', 'page', 'pageSize'];

export const EXCLUDED = {
  'GET /api/documents/events': 'server-sent event stream, never completes',
  'GET /api/address-autocomplete/search': 'calls an external geocoder',
  'GET /api/company-lookup': 'calls an external company registry',
  'GET /api/sirene/siret/{siret}': 'calls an external company registry',
  'GET /api/sso/lookup': 'resolves DNS for the e-mail domain',
  'GET /api/documents/types/{typeId}/fields/{fieldKey}/rows': 'the seeded invoice type has no row-selection field',
  'GET /api/documents/attachments/{fileRef}': 'needs an uploaded attachment',
  'GET /api/documents/received-invoices/upload/{fileRef}/ocr': 'needs an OCR upload, no OCR service on the runner',
  'GET /api/documents/received-invoices/{id}/file': 'needs a received invoice, no OCR service on the runner',
  'GET /api/documents/received-invoices/{id}/reconciliation': 'needs a received invoice, no OCR service on the runner',
  'GET /api/public/signatures/{token}': 'needs a pending e-signature request',
  'GET /api/public/signatures/{token}/document': 'needs a pending e-signature request',
  'GET /api/portal/me': 'needs a client-portal session',
  'GET /api/portal/statement': 'needs a client-portal session',
  'GET /api/portal/quotes': 'needs a client-portal session',
  'GET /api/portal/documents/{typeId}/{id}/pdf': 'needs a client-portal session',
  'GET /api/logs': 'instance administrator log stream',
  'GET /api/instance/danger/preflight': 'needs an instance operator account',
  'GET /api/documents/{id}/original': 'needs a document imported from another tool',
  'POST /api/danger/otp': 'destroys the seeded company',
  'POST /api/danger/reset/company-data': 'destroys the seeded company',
  'POST /api/danger/delete-company': 'destroys the seeded company',
  'POST /api/instance/danger/otp': 'destroys the instance',
  'POST /api/instance/danger/reset': 'destroys the instance',
  'DELETE /api/companies/leave': 'destroys the seeded company',
  'POST /api/companies/transfer': 'gives the seeded company away',
  'POST /api/auth-extended/set-password': "changes the session user's credentials",
  'POST /api/mcp': 'JSON-RPC endpoint, one route for every tool',
  'POST /api/company/mail-settings/test': 'sends a test e-mail through a company SMTP server',
  'POST /api/documents/received-invoices/upload': 'runs OCR, no OCR service on the runner',
  'POST /api/public/signatures/{token}/otp': 'needs a pending e-signature request',
  'POST /api/public/signatures/{token}/sign': 'needs a pending e-signature request',
  'POST /api/portal/quotes/{id}/request-signature': 'needs a client-portal session',
  'POST /api/portal/quotes/{id}/refuse': 'needs a client-portal session',
  'POST /api/portal/documents/invoice/{id}/checkout-session': 'needs a client-portal session and a payment provider',
};

// Mutating routes `latency.js` drives, in this order, on every scenario iteration.
export const SCRIPTED = [
  'POST /api/clients',
  'PATCH /api/clients/{id}',
  'POST /api/articles',
  'PATCH /api/articles/{id}',
  'DELETE /api/articles/{id}',
  'POST /api/documents/types/{typeId}/actions/{actionId}',
  'POST /api/documents/{id}/share-link',
  'DELETE /api/documents/{id}/share-link/{tokenId}',
  'POST /api/webhooks',
  'PATCH /api/webhooks/{id}',
  'DELETE /api/webhooks/{id}',
  'POST /api/projects',
  'PATCH /api/projects/{id}',
  'POST /api/time-entries',
  'PATCH /api/time-entries/{id}',
  'DELETE /api/time-entries/{id}',
  'POST /api/documents/expense-categories',
  'PUT /api/documents/expense-categories/{id}',
  'DELETE /api/documents/expense-categories/{id}',
  'POST /api/api-keys',
  'DELETE /api/api-keys/{id}',
  'DELETE /api/clients/{id}',
];

// The document actions the scenario runs through the one generic action route, each measured apart.
export const SCRIPTED_ACTIONS = ['quote save-draft', 'quote convert-to-invoice', 'invoice send'];
