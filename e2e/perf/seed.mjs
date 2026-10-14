// Seeds the one company every measurement runs against, at the fixed size in fixture.js, and writes
// the context plan.mjs and latency.js read: the session cookie and one id per kind of record.
//
//   node seed.mjs <base url> <context.json>
//
// The user, the company and its first clients and articles come from the load test's own seed.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { seed as seedLoadUsers } from '../load/seed.js';
import { SEED } from './fixture.js';

const LOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'cypress', 'fixtures', 'branding', 'logo-fixture.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export async function seedCompany(base) {
  const dir = mkdtempSync(join(tmpdir(), 'api-latency-'));
  const usersFile = join(dir, 'users.json');
  await seedLoadUsers({ base, count: 1, out: usersFile, pauseMs: 0 });
  const [user] = JSON.parse(readFileSync(usersFile, 'utf8'));

  // The throttler allows 120 requests per minute per client address and route; seeding hundreds of
  // documents through one route spreads them over addresses, as the load test does per user.
  let calls = 0;
  async function call(method, path, body) {
    calls++;
    const multipart = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(multipart ? {} : { 'content-type': 'application/json' }),
        origin: base,
        cookie: user.cookie,
        'x-forwarded-for': `100.65.${Math.floor(calls / 250) % 250}.${(calls % 250) + 1}`,
      },
      body: multipart ? body : body && JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  const action = (typeId, actionId, body) => call('POST', `/api/documents/types/${typeId}/actions/${actionId}`, body);

  // New clients copy the address of one the load seed created, so this file names no country.
  const { type, address, postalCode, city, country, countryCode, currency } = await call(
    'GET',
    `/api/clients/${user.clientIds[0]}`,
  );
  const clientTemplate = { type, address, postalCode, city, country, countryCode, currency, isActive: true };
  const clientIds = [...user.clientIds];
  while (clientIds.length < SEED.clients) {
    const n = clientIds.length;
    const client = await call('POST', '/api/clients', {
      ...clientTemplate,
      name: `Client ${n}`,
      contactEmail: `buyer-${n}@perf.test`,
    });
    clientIds.push(client.id);
  }
  const articleIds = [...user.articleIds];
  while (articleIds.length < SEED.articles) {
    const n = articleIds.length;
    const article = await call('POST', '/api/articles', {
      name: `Article ${n}`,
      type: 'SERVICE',
      unitPrice: 20 + n,
      vatRate: 19,
    });
    articleIds.push(article.id);
  }

  const lines = (n) =>
    Array.from({ length: 1 + (n % 5) }, (_, i) => ({
      description: `Line ${i + 1}`,
      quantity: 1 + i,
      unitPrice: 50 + 10 * i,
      vatRate: '19',
      unit: 'hour',
      articleId: articleIds[(n + i) % articleIds.length],
    }));
  const documentData = (n) => ({
    client: clientIds[n % clientIds.length],
    issueDate: today(),
    dueDate: inDays(30),
    currency: 'EUR',
    lines: lines(n),
  });

  let quoteId;
  for (let n = 0; n < SEED.quotes; n++) {
    quoteId = (await action('quote', 'save-draft', { data: documentData(n) })).document.id;
  }
  let draftInvoiceId;
  for (let n = 0; n < SEED.draftInvoices; n++) {
    draftInvoiceId = (await action('invoice', 'save-draft', { data: documentData(n) })).document.id;
  }
  let sentInvoiceId;
  for (let n = 0; n < SEED.sentInvoices; n++) {
    const data = documentData(n);
    const draft = await action('invoice', 'save-draft', { data });
    const sent = await action('invoice', 'send', { documentId: draft.document.id, data });
    sentInvoiceId = sent.document.id;
    await waitUntilSent(call, sentInvoiceId);
  }
  const shareLink = await call('POST', `/api/documents/${sentInvoiceId}/share-link?typeId=invoice`);

  const project = await call('POST', '/api/projects', { clientId: clientIds[0], name: 'Platform', hourlyRate: 90 });
  for (let n = 0; n < 20; n++) {
    await call('POST', '/api/time-entries', {
      projectId: project.id,
      date: inDays(-n),
      durationMinutes: 30 + 15 * (n % 6),
      description: `Work ${n}`,
    });
  }
  const webhook = await call('POST', '/api/webhooks', { url: 'http://127.0.0.1:9/perf', events: [] });
  const logo = new FormData();
  logo.append('file', new Blob([readFileSync(LOGO)], { type: 'image/png' }), 'logo.png');
  await call('POST', '/api/company/branding/logo', logo);
  const company = await call('GET', '/api/company/info');

  return {
    email: user.email,
    cookie: user.cookie,
    countryCode: company.countryCode,
    clientTemplate,
    ids: {
      client: clientIds[0],
      clients: clientIds,
      article: articleIds[0],
      articles: articleIds,
      quote: quoteId,
      draftInvoice: draftInvoiceId,
      sentInvoice: sentInvoiceId,
      shareToken: shareLink.token,
      project: project.id,
      webhook: webhook.data.id,
    },
  };
}

async function waitUntilSent(call, id) {
  const started = Date.now();
  while (Date.now() - started < 120000) {
    const doc = await call('GET', `/api/documents/${id}?typeId=invoice`);
    if (doc.status === 'sent') return;
    if (doc.status !== 'sending') throw new Error(`invoice ${id} ended ${doc.status}, not sent`);
    await sleep(500);
  }
  throw new Error(`invoice ${id} still sending after 120 s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, out] = process.argv.slice(2);
  if (!base || !out) {
    console.error('usage: node seed.mjs <base url> <context.json>');
    process.exit(1);
  }
  const started = Date.now();
  const context = await seedCompany(base);
  writeFileSync(out, `${JSON.stringify(context, null, 2)}\n`);
  console.log(`seed: one company, ${JSON.stringify(SEED)}, in ${Math.round((Date.now() - started) / 1000)} s`);
}
