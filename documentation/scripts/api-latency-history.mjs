// Shapes the API latency records of the `perf-data` branch into what the /api-latency page plots:
// the runs in date order, one compact series per route ([run index, p50, p95, p99, error rate]),
// the published releases as markers, and the latest run's coverage gaps.

export function buildHistory(records, releases) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const runs = sorted.map(({ kind, ref, commit, version, date, runner, k6 }) => ({
    kind,
    ref,
    commit,
    version,
    date,
    runner,
    k6,
  }));
  const routes = {};
  sorted.forEach((record, index) => {
    for (const [route, m] of Object.entries(record.routes)) {
      (routes[route] ??= []).push([index, m.p50, m.p95, m.p99, m.errorRate]);
    }
  });

  const published = releases
    .filter((r) => !r.draft && r.published_at)
    .map((r) => ({ tag: r.tag_name, date: r.published_at }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date;
  const inEffect = first ? published.filter((r) => r.date <= first).at(-1) : undefined;
  const markers = first ? published.filter((r) => r === inEffect || r.date > first) : [];

  return { runs, routes, releases: markers, unmeasured: sorted.at(-1)?.unmeasured ?? [] };
}
