import {type ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './api-latency.module.css';

type Run = {kind: string; ref: string; commit: string; label: string; date: string; runner: string; k6: string};
type Point = [run: number, p50: number, p95: number, p99: number, errorRate: number];
type History = {
  runs: Run[];
  routes: Record<string, Point[]>;
  releases: {tag: string; date: string}[];
  unmeasured: {route: string; reason: string}[];
};

const HEIGHT = 320;
const PAD = {top: 28, right: 16, bottom: 32, left: 52};
const DAY = 86400000;

const ms = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
const day = (iso: string) => iso.slice(0, 10);

function niceTicks(max: number): number[] {
  const raw = max / 4;
  const step = [1, 2, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(raw))).find((s) => s >= raw) ?? raw;
  return Array.from({length: Math.ceil(max / step) + 1}, (_, i) => i * step);
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Chart({history, route}: Readonly<{history: History; route: string}>): ReactNode {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const points = history.routes[route] ?? [];
  const times = history.runs.map((r) => Date.parse(r.date));
  const span = [...times, ...history.releases.map((r) => Date.parse(r.date))];
  const lo = Math.min(...span) - (span.length > 1 ? 0 : DAY);
  const hi = Math.max(...span) + (span.length > 1 ? 0 : DAY);
  const yTicks = niceTicks(Math.max(1, ...points.map((p) => p[3])) * 1.1);
  const yMax = yTicks.at(-1) ?? 1;
  const x = (t: number) => PAD.left + ((t - lo) / (hi - lo)) * (width - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / yMax) * (HEIGHT - PAD.top - PAD.bottom);
  const line = (k: 2 | 3) => points.map((p, i) => `${i ? 'L' : 'M'}${x(times[p[0]])},${y(p[k])}`).join('');
  const hovered = hover === null ? undefined : points[hover];

  function onMove(event: React.MouseEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left + PAD.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(times[p[0]]) - px) < Math.abs(x(times[points[best][0]]) - px)) best = i;
    });
    setHover(points.length ? best : null);
  }

  return (
    <div ref={ref} className={styles.chart}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`p95 and p99 of ${route} over time`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className={styles.axis} x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {t >= 1000 ? `${t / 1000}s` : `${t}`}
            </text>
          </g>
        ))}
        <text className={styles.axis} x={PAD.left} y={PAD.top - 14}>
          ms
        </text>
        {[lo, hi].map((t) => (
          <text
            key={t}
            className={styles.axis}
            x={x(t)}
            y={HEIGHT - 10}
            textAnchor={t === lo ? 'start' : 'end'}>
            {day(new Date(t).toISOString())}
          </text>
        ))}
        {history.releases.map((r, i) => (
          <g key={r.tag}>
            <line
              className={styles.release}
              x1={x(Date.parse(r.date))}
              x2={x(Date.parse(r.date))}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
            />
            <text
              className={styles.releaseLabel}
              x={x(Date.parse(r.date)) + (x(Date.parse(r.date)) > width - 110 ? -4 : 4)}
              y={PAD.top + 10 + (i % 2) * 13}
              textAnchor={x(Date.parse(r.date)) > width - 110 ? 'end' : 'start'}>
              {r.tag}
            </text>
          </g>
        ))}
        <path className={styles.p99} d={line(3)} />
        <path className={styles.p95} d={line(2)} />
        {points.map((p) => (
          <g key={p[0]}>
            <circle className={styles.p99Dot} cx={x(times[p[0]])} cy={y(p[3])} r={4} />
            <circle className={styles.p95Dot} cx={x(times[p[0]])} cy={y(p[2])} r={4} />
          </g>
        ))}
        {hovered && (
          <line
            className={styles.crosshair}
            x1={x(times[hovered[0]])}
            x2={x(times[hovered[0]])}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
          />
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={Math.max(0, width - PAD.left - PAD.right)}
          height={HEIGHT - PAD.top - PAD.bottom}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hovered && (
        <div
          className={styles.tooltip}
          style={{
            left: x(times[hovered[0]]) + 232 < width ? x(times[hovered[0]]) + 12 : x(times[hovered[0]]) - 232,
            top: HEIGHT - PAD.bottom - 150,
          }}>
          <strong>{day(history.runs[hovered[0]].date)}</strong> {history.runs[hovered[0]].kind}
          <br />
          {history.runs[hovered[0]].label}
          <dl>
            <dt>p50</dt>
            <dd>{ms(hovered[1])} ms</dd>
            <dt>p95</dt>
            <dd>{ms(hovered[2])} ms</dd>
            <dt>p99</dt>
            <dd>{ms(hovered[3])} ms</dd>
            <dt>errors</dt>
            <dd>{Math.round(hovered[4] * 100)}%</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function Latest({
  history,
  route,
  onSelect,
}: Readonly<{history: History; route: string; onSelect: (r: string) => void}>) {
  const last = history.runs.length - 1;
  const rows = Object.entries(history.routes)
    .map(([name, points]) => ({name, p: points.at(-1)!}))
    .filter((r) => r.p[0] === last)
    .sort((a, b) => b.p[2] - a.p[2]);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Route</th>
          <th>p50</th>
          <th>p95</th>
          <th>p99</th>
          <th>Errors</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({name, p}) => (
          <tr key={name} className={name === route ? styles.selected : undefined}>
            <td>
              <button type="button" className={styles.routeButton} onClick={() => onSelect(name)}>
                <code>{name}</code>
              </button>
            </td>
            <td>{ms(p[1])}</td>
            <td>{ms(p[2])}</td>
            <td>{ms(p[3])}</td>
            <td>{Math.round(p[4] * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ApiLatency(): ReactNode {
  const url = useBaseUrl('/api-latency.json');
  const [history, setHistory] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  const [route, setRoute] = useState('');

  useEffect(() => {
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: History) => setHistory(data))
      .catch(() => setFailed(true));
  }, [url]);

  const options = useMemo(() => {
    if (!history) return [];
    return Object.entries(history.routes)
      .map(([name, points]) => ({name, p95: points.at(-1)![2]}))
      .sort((a, b) => b.p95 - a.p95);
  }, [history]);
  const selected = route || options[0]?.name || '';
  const latest = history?.runs.at(-1);

  return (
    <Layout title="API latency" description="p95 and p99 of every API route over time, per version">
      <main className="container margin-vert--lg">
        <Heading as="h1">API latency</Heading>
        <p>
          p95 and p99 of every API route, measured every night on <code>dev</code> and on each release pull
          request, one request at a time on a GitHub-hosted runner. Release dates are marked. How it is
          measured: <Link to="/docs/developer-guide/api-latency">API latency tracking</Link>.
        </p>
        {failed && <p>The history could not be loaded.</p>}
        {!failed && !history && <p>Loading...</p>}
        {history?.runs.length === 0 && <p>No run recorded yet.</p>}
        {history && latest && (
          <>
            <div className={styles.controls}>
              <label htmlFor="api-latency-route">Route</label>
              <select id="api-latency-route" value={selected} onChange={(e) => setRoute(e.target.value)}>
                {options.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.legend} aria-hidden="true">
              <span>
                <span className={styles.swatchP95} /> p95
              </span>
              <span>
                <span className={styles.swatchP99} /> p99
              </span>
              <span>
                <span className={styles.swatchRelease} /> release
              </span>
            </div>
            <Chart history={history} route={selected} />
            <p className={styles.meta}>
              {history.runs.length} {history.runs.length === 1 ? 'run' : 'runs'}. Latest: {day(latest.date)}, <code>{latest.label}</code>, {latest.runner}
              , k6 {latest.k6}.
            </p>
            <Heading as="h2">Latest run, slowest first</Heading>
            <Latest history={history} route={selected} onSelect={setRoute} />
            <details>
              <summary>Routes not measured ({history.unmeasured.length}), and why</summary>
              <ul>
                {history.unmeasured.map((u) => (
                  <li key={u.route}>
                    <code>{u.route}</code>: {u.reason}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </main>
    </Layout>
  );
}
