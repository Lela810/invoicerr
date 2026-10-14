import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildHistory } from './api-latency-history.mjs';

const record = (date, kind, commit, p95, extra = {}) => ({
  kind,
  ref: 'dev',
  commit,
  version: `v2.0.0-alpha.9-1-g${commit}`,
  date,
  runner: 'ubuntu24, 4 CPU',
  k6: 'v1.7.1',
  routes: { 'GET /api/health': { p50: 1, p95, p99: p95 * 2, count: 60, errorRate: 0 }, ...extra },
  unmeasured: [{ route: 'GET /api/logs', reason: 'admin' }],
});

test('runs are ordered by date and every route becomes one series indexed by run', () => {
  const history = buildHistory(
    [
      record('2026-10-02T02:20:00Z', 'nightly', 'b', 3, {
        'GET /api/new': { p50: 5, p95: 6, p99: 7, count: 60, errorRate: 0.1 },
      }),
      record('2026-10-01T02:20:00Z', 'nightly', 'a', 2),
    ],
    [],
  );
  assert.deepEqual(
    history.runs.map((r) => r.commit),
    ['a', 'b'],
  );
  assert.deepEqual(history.routes['GET /api/health'], [
    [0, 1, 2, 4, 0],
    [1, 1, 3, 6, 0],
  ]);
  assert.deepEqual(history.routes['GET /api/new'], [[1, 5, 6, 7, 0.1]]);
});

test('the coverage shown is the latest run', () => {
  const history = buildHistory([record('2026-10-01T02:20:00Z', 'nightly', 'a', 2)], []);
  assert.deepEqual(history.unmeasured, [{ route: 'GET /api/logs', reason: 'admin' }]);
});

test('the release in effect at the first run and every later one become markers, oldest first', () => {
  const history = buildHistory(
    [record('2026-10-01T02:20:00Z', 'nightly', 'a', 2)],
    [
      { tag_name: 'v2.0.0-alpha.9', published_at: '2026-10-05T10:00:00Z', draft: false },
      { tag_name: 'v2.0.0-alpha.8', published_at: '2026-09-30T10:00:00Z', draft: false },
      { tag_name: 'v2.0.0-alpha.10', published_at: null, draft: true },
      { tag_name: 'v2.0.0-alpha.7', published_at: '2026-09-01T10:00:00Z', draft: false },
    ],
  );
  assert.deepEqual(history.releases, [
    { tag: 'v2.0.0-alpha.8', date: '2026-09-30T10:00:00Z' },
    { tag: 'v2.0.0-alpha.9', date: '2026-10-05T10:00:00Z' },
  ]);
});

test('no record yet gives an empty history the page can still render', () => {
  assert.deepEqual(buildHistory([], [{ tag_name: 'v1', published_at: '2026-01-01T00:00:00Z' }]), {
    runs: [],
    routes: {},
    releases: [],
    unmeasured: [],
  });
});

test('a run is labelled by its short commit and the latest release published before it', () => {
  const history = buildHistory(
    [
      record('2026-10-13T02:20:00Z', 'nightly', '5f5c74159e50', 2),
      record('2026-09-01T02:20:00Z', 'nightly', '0123456789ab', 2),
    ],
    [
      { tag_name: 'v2.0.0-alpha.5', published_at: '2026-10-12T17:53:50Z', draft: false },
      { tag_name: 'v2.0.0-alpha.6', published_at: '2026-10-14T10:00:00Z', draft: false },
    ],
  );
  assert.deepEqual(
    history.runs.map((r) => r.label),
    ['01234567', '5f5c7415 after v2.0.0-alpha.5'],
  );
});
