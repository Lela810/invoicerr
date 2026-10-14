import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baselineFrom, renderComparison, toRecord } from './report.mjs';

const meta = {
  kind: 'nightly',
  ref: 'dev',
  commit: 'abc1234',
  version: 'v2.0.0-alpha.9-3-gabc1234',
  date: '2026-10-14T03:00:00Z',
  runner: 'ubuntu-24.04 (4 CPU)',
  k6: 'v1.7.1',
};

test('a record keeps the per-route numbers rounded to a tenth of a millisecond, with its context', () => {
  const record = toRecord(
    { routes: { 'GET /api/health': { p50: 1.234, p95: 2.345, p99: 3.456, count: 60, errorRate: 0 } } },
    { unmeasured: [{ route: 'GET /api/logs', reason: 'admin' }] },
    meta,
  );
  assert.deepEqual(record, {
    ...meta,
    routes: { 'GET /api/health': { p50: 1.2, p95: 2.3, p99: 3.5, count: 60, errorRate: 0 } },
    unmeasured: [{ route: 'GET /api/logs', reason: 'admin' }],
  });
});

const run = (date, kind, p95, p99 = p95 * 2) => ({
  date,
  kind,
  routes: { 'GET /api/x': { p50: 1, p95, p99, count: 60, errorRate: 0 } },
});

test('the baseline is the median of the five most recent nightly runs', () => {
  const records = [
    run('2026-10-01', 'nightly', 100),
    run('2026-10-02', 'nightly', 10),
    run('2026-10-03', 'nightly', 30),
    run('2026-10-04', 'release', 1),
    run('2026-10-05', 'nightly', 20),
    run('2026-10-06', 'nightly', 50),
    run('2026-10-07', 'nightly', 40),
  ];
  assert.deepEqual(baselineFrom(records), {
    runs: 5,
    from: '2026-10-02',
    to: '2026-10-07',
    routes: { 'GET /api/x': { p95: 30, p99: 60 } },
  });
});

test('no nightly run yet means an empty baseline', () => {
  assert.deepEqual(baselineFrom([run('2026-10-04', 'release', 1)]), { runs: 0, routes: {} });
});

const head = {
  ...meta,
  kind: 'pr',
  routes: {
    'GET /api/fast': { p50: 1, p95: 10, p99: 12, count: 60, errorRate: 0 },
    'GET /api/slower': { p50: 5, p95: 30, p99: 40, count: 60, errorRate: 0 },
    'GET /api/new': { p50: 2, p95: 4, p99: 5, count: 60, errorRate: 0.5 },
  },
  unmeasured: [{ route: 'GET /api/logs', reason: 'instance administrator log stream' }],
};
const baseline = {
  runs: 5,
  from: '2026-10-02',
  to: '2026-10-07',
  routes: { 'GET /api/fast': { p95: 20, p99: 24 }, 'GET /api/slower': { p95: 20, p99: 20 } },
};

test('the comparison lists the largest regression first and a route with no baseline last', () => {
  const md = renderComparison(head, baseline);
  const rows = md.split('routes measured')[0].split('\n').filter((l) => l.startsWith('| `'));
  assert.deepEqual(rows, [
    '| `GET /api/slower` | 20.0 | 30.0 | +10.0 (+50%) | 20.0 | 40.0 | +20.0 (+100%) | 5.0 | 0% |',
    '| `GET /api/fast` | 20.0 | 10.0 | -10.0 (-50%) | 24.0 | 12.0 | -12.0 (-50%) | 1.0 | 0% |',
    '| `GET /api/new` | n/a | 4.0 | n/a | n/a | 5.0 | n/a | 2.0 | 50% |',
  ]);
});

test('the comparison carries its marker, says what it compared against, and lists the coverage gaps', () => {
  const md = renderComparison(head, baseline);
  assert.ok(md.startsWith('<!-- api-latency-comment -->'));
  assert.match(md, /median of the last 5 nightly runs \(2026-10-02 to 2026-10-07\)/);
  assert.match(md, /3 routes measured, 1 not measured/);
  assert.match(md, /\| `GET \/api\/logs` \| instance administrator log stream \|/);
  assert.match(md, /never fails/);
});

test('without any nightly run the comparison says so instead of comparing', () => {
  const md = renderComparison(head, { runs: 0, routes: {} });
  assert.match(md, /No nightly run recorded yet/);
});

test('a single nightly run is named as such', () => {
  const md = renderComparison(head, { ...baseline, runs: 1, from: '2026-10-07', to: '2026-10-07' });
  assert.match(md, /against the only nightly run so far \(2026-10-07\)/);
});
