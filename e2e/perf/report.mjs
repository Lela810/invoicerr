// Turns a k6 result into a history record, and a head record into the pull request comment.
//
//   node report.mjs record <result.json> <plan.json> <record.json>
//       context from PERF_KIND, PERF_REF, PERF_COMMIT, PERF_VERSION, PERF_RUNNER, PERF_K6
//   node report.mjs compare <record.json> <history dir> <comment.md>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER = '<!-- api-latency-comment -->';
const BASELINE_RUNS = 5;

const tenth = (n) => Math.round(n * 10) / 10;

export function toRecord(result, plan, meta) {
  const routes = {};
  for (const [route, m] of Object.entries(result.routes)) {
    routes[route] = { p50: tenth(m.p50), p95: tenth(m.p95), p99: tenth(m.p99), count: m.count, errorRate: m.errorRate };
  }
  return { ...meta, routes, unmeasured: plan.unmeasured };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function baselineFrom(records) {
  const nightly = records
    .filter((r) => r.kind === 'nightly')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-BASELINE_RUNS);
  if (nightly.length === 0) return { runs: 0, routes: {} };
  const routes = {};
  for (const route of new Set(nightly.flatMap((r) => Object.keys(r.routes)))) {
    const runs = nightly.map((r) => r.routes[route]).filter(Boolean);
    routes[route] = { p95: median(runs.map((m) => m.p95)), p99: median(runs.map((m) => m.p99)) };
  }
  return {
    runs: nightly.length,
    from: nightly[0].date.slice(0, 10),
    to: nightly.at(-1).date.slice(0, 10),
    routes,
  };
}

const ms = (n) => (n === undefined ? 'n/a' : n.toFixed(1));

function delta(base, head) {
  if (base === undefined) return 'n/a';
  const d = head - base;
  const sign = d >= 0 ? '+' : '-';
  const pct = base > 0 ? ` (${sign}${Math.abs(Math.round((d / base) * 100))}%)` : '';
  return `${sign}${Math.abs(d).toFixed(1)}${pct}`;
}

const regression = (base, head) => (base === undefined || base <= 0 ? -Infinity : (head - base) / base);

export function renderComparison(head, baseline) {
  const rows = Object.entries(head.routes)
    .map(([route, m]) => ({ route, m, base: baseline.routes[route] ?? {} }))
    .sort(
      (a, b) =>
        regression(b.base.p95, b.m.p95) - regression(a.base.p95, a.m.p95) || a.route.localeCompare(b.route),
    )
    .map(
      ({ route, m, base }) =>
        `| \`${route}\` | ${ms(base.p95)} | ${ms(m.p95)} | ${delta(base.p95, m.p95)} | ${ms(base.p99)} | ${ms(m.p99)} | ${delta(base.p99, m.p99)} | ${ms(m.p50)} | ${Math.round(m.errorRate * 100)}% |`,
    );

  let against = '. No nightly run recorded yet, so the base columns are empty';
  if (baseline.runs === 1) against = ` against the only nightly run so far (${baseline.from})`;
  if (baseline.runs > 1) {
    against = ` against the median of the last ${baseline.runs} nightly runs (${baseline.from} to ${baseline.to})`;
  }
  const unmeasured = head.unmeasured ?? [];

  return [
    MARKER,
    '## API latency',
    '',
    `Head \`${head.commit}\`${against}. Milliseconds, one request at a time, on ${head.runner} with k6 ${head.k6}.`,
    'Informative only: this check never fails on a regression. Sorted by the largest p95 regression.',
    '',
    '| Route | Base p95 | Head p95 | Delta p95 | Base p99 | Head p99 | Delta p99 | Head p50 | Errors |',
    '|---|--:|--:|--:|--:|--:|--:|--:|--:|',
    ...rows,
    '',
    `${rows.length} routes measured, ${unmeasured.length} not measured.`,
    '',
    '<details><summary>Not measured, and why</summary>',
    '',
    '| Route | Reason |',
    '|---|---|',
    ...unmeasured.map((u) => `| \`${u.route}\` | ${u.reason} |`),
    '',
    '</details>',
    '',
  ].join('\n');
}

function readHistory(dir) {
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2);
  const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
  if (command === 'record') {
    const [resultPath, planPath, out] = args;
    const env = process.env;
    const meta = {
      kind: env.PERF_KIND,
      ref: env.PERF_REF,
      commit: env.PERF_COMMIT,
      version: env.PERF_VERSION,
      date: new Date().toISOString(),
      runner: env.PERF_RUNNER,
      k6: env.PERF_K6,
    };
    writeFileSync(out, `${JSON.stringify(toRecord(read(resultPath), read(planPath), meta), null, 2)}\n`);
  } else if (command === 'compare') {
    const [recordPath, historyDir, out] = args;
    writeFileSync(out, renderComparison(read(recordPath), baselineFrom(readHistory(historyDir))));
  } else {
    console.error('usage: node report.mjs record|compare ...');
    process.exit(1);
  }
}
