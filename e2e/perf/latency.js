// k6: per-route latency of the API on a seeded instance, one request at a time.
//
//   k6 run -e BASE=http://localhost:4000 -e PLAN=plan.json -e CONTEXT=context.json -e OUT=result.json latency.js
//
// One virtual user, one iteration: a warm-up pass over every GET route in the plan (not recorded),
// the recorded passes (fixture.js says how many per route), then SCENARIO_ITERATIONS of the scripted
// mutating scenario. A single request in flight keeps the numbers about the route, not contention.
import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/execution';
import { Rate, Trend } from 'k6/metrics';

import {
  GET_PASSES,
  SCENARIO_ITERATIONS,
  SCRIPTED_ACTIONS,
  SLOW_ROUTE_MS,
  SLOW_ROUTE_PASSES,
} from './fixture.js';

const BASE = __ENV.BASE;
const plan = JSON.parse(open(__ENV.PLAN));
const context = JSON.parse(open(__ENV.CONTEXT));

const ACTION_ROUTE = 'POST /api/documents/types/{typeId}/actions/{actionId}';
const keys = [
  ...plan.requests.map((r) => r.route),
  ...plan.scripted.filter((r) => r !== ACTION_ROUTE),
  ...(plan.scripted.includes(ACTION_ROUTE) ? SCRIPTED_ACTIONS.map((a) => `${ACTION_ROUTE} [${a}]`) : []),
];
const durations = {};
const errors = {};
keys.forEach((key, i) => {
  durations[key] = new Trend(`route_${i}`, true);
  errors[key] = new Rate(`route_${i}_errors`);
});

export const options = {
  scenarios: { measure: { executor: 'per-vu-iterations', vus: 1, iterations: 1, maxDuration: '40m' } },
  summaryTrendStats: ['p(50)', 'p(95)', 'p(99)', 'count'],
};

let clientAddress = '100.66.0.1';
function headers(hasBody) {
  const h = { origin: BASE, cookie: context.cookie, 'x-forwarded-for': clientAddress };
  if (hasBody) h['content-type'] = 'application/json';
  return h;
}

function record(key, res) {
  if (!durations[key]) exec.test.abort(`no metric declared for ${key}`);
  durations[key].add(res.timings.duration);
  errors[key].add(res.status === 0 || res.status >= 400);
  return res;
}

function send(key, method, path, body) {
  const res = http.request(method, BASE + path, body === undefined ? null : JSON.stringify(body), {
    headers: headers(body !== undefined),
    tags: { name: key ?? 'untracked' },
    timeout: '120s',
  });
  return key ? record(key, res) : res;
}

const json = (res, path) => (res.status < 400 ? res.json(path) : undefined);
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

const passes = {};

function warmUp() {
  for (const r of plan.requests) {
    const res = send(null, 'GET', r.url);
    passes[r.route] = res.timings.duration > SLOW_ROUTE_MS ? SLOW_ROUTE_PASSES : GET_PASSES;
  }
}

function readPass(pass) {
  for (const r of plan.requests) if (pass < passes[r.route]) send(r.route, 'GET', r.url);
}

function lines(n) {
  return Array.from({ length: 5 }, (_, i) => ({
    description: `Line ${i + 1}`,
    quantity: 1 + i,
    unitPrice: 50 + 10 * i,
    vatRate: '19',
    unit: 'hour',
    articleId: context.ids.articles[(n + i) % context.ids.articles.length],
  }));
}

function action(variant, body) {
  const [typeId, actionId] = variant.split(' ');
  return send(`${ACTION_ROUTE} [${variant}]`, 'POST', `/api/documents/types/${typeId}/actions/${actionId}`, body);
}

function waitUntilSent(id) {
  const started = Date.now();
  let status = 'sending';
  while (status === 'sending' && Date.now() - started < 120000) {
    sleep(0.5);
    const res = send(null, 'GET', `/api/documents/${id}?typeId=invoice`);
    if (res.status === 200) status = res.json('status');
  }
}

function scenario(n) {
  const clientBody = { ...context.clientTemplate, name: `Scenario ${n}`, contactEmail: `scenario-${n}@perf.test` };
  const clientId = json(send('POST /api/clients', 'POST', '/api/clients', clientBody), 'id');
  send('PATCH /api/clients/{id}', 'PATCH', `/api/clients/${clientId}`, { ...clientBody, id: clientId, name: `Scenario ${n} renamed` });

  const articleId = json(
    send('POST /api/articles', 'POST', '/api/articles', { name: `Scenario ${n}`, type: 'SERVICE', unitPrice: 80, vatRate: 19 }),
    'id',
  );
  send('PATCH /api/articles/{id}', 'PATCH', `/api/articles/${articleId}`, { unitPrice: 85 });
  send('DELETE /api/articles/{id}', 'DELETE', `/api/articles/${articleId}`);

  const data = {
    client: context.ids.clients[n % context.ids.clients.length],
    issueDate: today(),
    currency: 'EUR',
    lines: lines(n),
  };
  const quoteId = json(action('quote save-draft', { data }), 'document.id');
  const converted = action('quote convert-to-invoice', { documentId: quoteId, data });
  const invoiceId = json(converted, 'document.id');
  if (invoiceId) {
    const invoiceData = { ...converted.json('document.data'), dueDate: inDays(30), lines: data.lines };
    const sent = action('invoice send', { documentId: invoiceId, data: invoiceData });
    if (json(sent, 'document.status') === 'sending') waitUntilSent(invoiceId);

    const share = send(
      'POST /api/documents/{id}/share-link',
      'POST',
      `/api/documents/${invoiceId}/share-link?typeId=invoice`,
    );
    send(
      'DELETE /api/documents/{id}/share-link/{tokenId}',
      'DELETE',
      `/api/documents/${invoiceId}/share-link/${json(share, 'id')}?typeId=invoice`,
    );
  }

  const webhookId = json(
    send('POST /api/webhooks', 'POST', '/api/webhooks', { url: 'http://127.0.0.1:9/perf', events: [] }),
    'data.id',
  );
  send('PATCH /api/webhooks/{id}', 'PATCH', `/api/webhooks/${webhookId}`, { url: 'http://127.0.0.1:9/perf-2' });
  send('DELETE /api/webhooks/{id}', 'DELETE', `/api/webhooks/${webhookId}`);

  const projectId = json(
    send('POST /api/projects', 'POST', '/api/projects', { clientId, name: `Scenario ${n}`, hourlyRate: 90 }),
    'id',
  );
  send('PATCH /api/projects/{id}', 'PATCH', `/api/projects/${projectId}`, { isArchived: true });
  const entryId = json(
    send('POST /api/time-entries', 'POST', '/api/time-entries', {
      projectId,
      date: today(),
      durationMinutes: 45,
      description: 'Scenario',
    }),
    'id',
  );
  send('PATCH /api/time-entries/{id}', 'PATCH', `/api/time-entries/${entryId}`, { durationMinutes: 60 });
  send('DELETE /api/time-entries/{id}', 'DELETE', `/api/time-entries/${entryId}`);

  const categoryId = json(
    send('POST /api/documents/expense-categories', 'POST', '/api/documents/expense-categories', {
      label: `Scenario ${n}`,
    }),
    'id',
  );
  send('PUT /api/documents/expense-categories/{id}', 'PUT', `/api/documents/expense-categories/${categoryId}`, {
    label: `Scenario ${n} renamed`,
  });
  send('DELETE /api/documents/expense-categories/{id}', 'DELETE', `/api/documents/expense-categories/${categoryId}`);

  const keyId = json(send('POST /api/api-keys', 'POST', '/api/api-keys', { name: `Scenario ${n}` }), 'id');
  send('DELETE /api/api-keys/{id}', 'DELETE', `/api/api-keys/${keyId}`);

  send('DELETE /api/clients/{id}', 'DELETE', `/api/clients/${clientId}`);
}

export default function measure() {
  const probe = send(null, 'GET', '/api/company/info');
  if (probe.status !== 200) exec.test.abort(`the seeded session does not work: GET /api/company/info answered ${probe.status}`);

  warmUp();
  for (let pass = 0; pass < GET_PASSES; pass++) {
    clientAddress = `100.66.1.${pass + 1}`;
    readPass(pass);
  }
  for (let n = 0; n < SCENARIO_ITERATIONS; n++) {
    clientAddress = `100.66.2.${n + 1}`;
    scenario(n);
  }
}

export function handleSummary(data) {
  const routes = {};
  keys.forEach((key, i) => {
    const d = data.metrics[`route_${i}`]?.values;
    const e = data.metrics[`route_${i}_errors`]?.values;
    if (!d) return;
    routes[key] = { p50: d['p(50)'], p95: d['p(95)'], p99: d['p(99)'], count: d.count, errorRate: e ? e.rate : 0 };
  });
  return { [__ENV.OUT]: JSON.stringify({ routes }, null, 2), stdout: `measured ${Object.keys(routes).length} routes\n` };
}

