// Writes static/api-latency.json for the /api-latency page from the records on the `perf-data`
// branch (see .github/workflows/api-latency.yml) and the published releases. API_LATENCY_RECORDS
// points at a local directory of records instead, for a preview. Never fails the build: without
// records or without the releases, the page says so.
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHistory } from './api-latency-history.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'api-latency.json');
const RELEASES = 'https://api.github.com/repos/invoicerr-app/invoicerr/releases?per_page=100';

function recordsFromBranch() {
  const dir = mkdtempSync(join(tmpdir(), 'api-latency-'));
  execFileSync('git', ['fetch', '--quiet', '--depth=1', 'origin', 'perf-data'], { stdio: 'pipe' });
  execSync(`git archive FETCH_HEAD records | tar -x -C "${dir}"`, { stdio: 'pipe' });
  return join(dir, 'records');
}

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
try {
  records = readRecords(process.env.API_LATENCY_RECORDS ?? recordsFromBranch());
} catch (err) {
  console.warn(`api-latency: no records (${err.message.split('\n')[0]})`);
}
let releases = [];
try {
  releases = await fetchReleases();
} catch (err) {
  console.warn(`api-latency: no release markers (${err.message})`);
}
writeFileSync(OUT, JSON.stringify(buildHistory(records, releases)));
console.log(`api-latency: ${records.length} runs written to static/api-latency.json`);
