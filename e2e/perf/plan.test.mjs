import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPlan } from './plan.mjs';

const op = (parameters = []) => ({ parameters, responses: {} });
const path = (name) => ({ in: 'path', name, required: true, schema: { type: 'string' } });
const query = (name, required = false) => ({ in: 'query', name, required, schema: { type: 'string' } });

const context = {
  email: 'perf@example.test',
  countryCode: 'XX',
  ids: { client: 'c1', sentInvoice: 'i1', shareToken: 't1' },
};

const routes = (plan) => plan.requests.map((r) => `${r.route} -> ${r.url}`);

test('a GET route without parameters is measured as is', () => {
  const plan = buildPlan({ paths: { '/api/health': { get: op() } } }, context);
  assert.deepEqual(routes(plan), ['GET /api/health -> /api/health']);
  assert.deepEqual(plan.unmeasured, []);
});

test('a path id is resolved from the seeded record its collection names', () => {
  const plan = buildPlan({ paths: { '/api/clients/{id}': { get: op([path('id')]) } } }, context);
  assert.deepEqual(routes(plan), ['GET /api/clients/{id} -> /api/clients/c1']);
});

test('a required query parameter gets a realistic value, an unknown optional one is left out', () => {
  const plan = buildPlan(
    {
      paths: {
        '/api/documents/{id}/pdf': { get: op([path('id'), query('typeId', true), query('somethingNew')]) },
      },
    },
    context,
  );
  assert.deepEqual(routes(plan), ['GET /api/documents/{id}/pdf -> /api/documents/i1/pdf?typeId=invoice']);
});

test('list routes are paged the way the app pages them', () => {
  const plan = buildPlan(
    { paths: { '/api/documents': { get: op([query('typeId'), query('page'), query('pageSize'), query('q')]) } } },
    context,
  );
  assert.deepEqual(routes(plan), ['GET /api/documents -> /api/documents?typeId=invoice&page=1&pageSize=25']);
});

test('a path parameter nothing was seeded for is reported, not guessed', () => {
  const plan = buildPlan(
    { paths: { '/api/bank-reconciliation/statements/{id}/lines': { get: op([path('id')]) } } },
    context,
  );
  assert.deepEqual(plan.requests, []);
  assert.deepEqual(plan.unmeasured, [
    {
      route: 'GET /api/bank-reconciliation/statements/{id}/lines',
      reason: 'no seeded value for path parameter "id"',
    },
  ]);
});

test('a required query parameter without a known value is reported', () => {
  const plan = buildPlan({ paths: { '/api/things': { get: op([query('mystery', true)]) } } }, context);
  assert.deepEqual(plan.unmeasured, [
    { route: 'GET /api/things', reason: 'no value for required query parameter "mystery"' },
  ]);
});

test('an excluded GET route carries its own reason', () => {
  const plan = buildPlan({ paths: { '/api/documents/events': { get: op() } } }, context);
  assert.deepEqual(plan.requests, []);
  assert.equal(plan.unmeasured[0].route, 'GET /api/documents/events');
  assert.match(plan.unmeasured[0].reason, /stream/);
});

test('a mutating route is either in the scripted scenario or reported with a reason', () => {
  const plan = buildPlan(
    {
      paths: {
        '/api/clients': { post: op() },
        '/api/danger/delete-company': { post: op() },
        '/api/brand-new': { post: op() },
      },
    },
    context,
  );
  assert.deepEqual(plan.requests, []);
  assert.deepEqual(plan.scripted, ['POST /api/clients']);
  assert.deepEqual(
    plan.unmeasured.map((u) => u.route),
    ['POST /api/danger/delete-company', 'POST /api/brand-new'],
  );
  assert.match(plan.unmeasured[0].reason, /destroys/);
  assert.equal(plan.unmeasured[1].reason, 'mutating route outside the scripted scenario');
});
