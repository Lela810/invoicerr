// Turns the `lhci upload --target=filesystem` output into a Markdown table (job summary, PR comment)
// and fails when a page ended on a different path than the one requested, which would mean the
// audit measured a redirect (sign-in) instead of the screen, or when a page scores below 100 in
// accessibility. The other categories stay informative.
const fs = require('node:fs')
const path = require('node:path')

const dir = '.lighthouseci'
const out = path.join(dir, 'comment.md')
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
const pct = (v) => (v == null ? 'n/a' : String(Math.round(v * 100)))

let mismatches = 0
const inaccessible = []
const rows = manifest.map((entry) => {
  const lhr = JSON.parse(fs.readFileSync(path.join(dir, path.basename(entry.jsonPath)), 'utf8'))
  const requested = new URL(entry.url).pathname
  const final = new URL(lhr.finalDisplayedUrl || lhr.finalUrl).pathname
  const ok = requested === final
  if (!ok) mismatches += 1
  const s = entry.summary
  if (s.accessibility == null || s.accessibility < 1) {
    const failed = (lhr.categories.accessibility?.auditRefs ?? [])
      .map((ref) => lhr.audits[ref.id])
      .filter((audit) => audit?.scoreDisplayMode === 'binary' && audit.score < 1)
      .map((audit) => `\`${audit.id}\``)
    inaccessible.push(`\`${requested}\`: ${pct(s.accessibility)}, ${failed.join(', ') || 'no failing audit listed'}`)
  }
  return `| \`${requested}\` | \`${final}\`${ok ? '' : ' (redirected)'} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} | ${pct(s.seo)} |`
})

fs.writeFileSync(
  out,
  [
    '<!-- lighthouse-ci-comment -->',
    '### Lighthouse CI',
    '',
    'Logged-in screens of a seeded instance. Accessibility below 100 fails the job; the other scores are informative.',
    '',
    '| Page | Final URL | Performance | Accessibility | Best Practices | SEO |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    ...(inaccessible.length ? ['Accessibility below 100:', '', ...inaccessible.map((line) => `- ${line}`), ''] : []),
    'Full reports: the `lighthouse-report` artifact on this run.',
    '',
  ].join('\n'),
)

if (rows.length === 0) console.error('The manifest lists no audited page')
if (mismatches > 0) console.error(`${mismatches} page(s) did not end on the requested path`)
for (const line of inaccessible) console.error(`Accessibility below 100 on ${line.replaceAll('`', '')}`)
if (rows.length === 0 || mismatches > 0 || inaccessible.length > 0) process.exit(1)
