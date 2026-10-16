// Shapes the API latency records of the `perf-data` branch into what the /api-latency page plots:
// the runs in date order, each labelled by its short commit and the last release published before
// it, one compact series per route ([run index, p50, p95, p99, error rate]), the published releases
// as markers, and the latest run's coverage gaps.

export function buildHistory(records, releases) {
  const published = releases
    .filter((r) => !r.draft && r.published_at)
    .map((r) => ({ tag: r.tag_name, date: r.published_at }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const runs = sorted.map(({ kind, ref, commit, date, runner, k6 }) => {
    const after = published.findLast((r) => r.date <= date);
    const label = after ? `${commit.slice(0, 8)} after ${after.tag}` : commit.slice(0, 8);
    return { kind, ref, commit, label, date, runner, k6 };
  });
  const routes = {};
  sorted.forEach((record, index) => {
    for (const [route, m] of Object.entries(record.routes)) {
      routes[route] ??= [];
      routes[route].push([index, m.p50, m.p95, m.p99, m.errorRate]);
    }
  });

  const first = sorted[0]?.date;
  const inEffect = first ? published.findLast((r) => r.date <= first) : undefined;
  const markers = first ? published.filter((r) => r === inEffect || r.date > first) : [];

  return { runs, routes, releases: markers, unmeasured: sorted.at(-1)?.unmeasured ?? [] };
}
