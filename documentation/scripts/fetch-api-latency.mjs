// Writes static/api-latency.json for the /api-latency page from a directory of API latency records
// (API_LATENCY_RECORDS, extracted from the `perf-data` branch by docs-deploy.yml) and the published
// releases. Never fails the build: without records or without the releases, the page says so.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHistory } from './api-latency-history.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'api-latency.json');
const RELEASES = 'https://api.github.com/repos/invoicerr-app/invoicerr/releases?per_page=100';

function readRecords(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

async function fetchReleases() {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(RELEASES, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

let records = [];
if (process.env.API_LATENCY_RECORDS) {
  try {
    records = readRecords(process.env.API_LATENCY_RECORDS);
  } catch (err) {
    console.warn(`api-latency: no records (${err.message})`);
  }
} else {
  console.warn('api-latency: API_LATENCY_RECORDS is not set, the page will show no run');
}
let releases = [];
try {
  releases = await fetchReleases();
} catch (err) {
  console.warn(`api-latency: no release markers (${err.message})`);
}
writeFileSync(OUT, JSON.stringify(buildHistory(records, releases)));
console.log(`api-latency: ${records.length} runs written to static/api-latency.json`);
