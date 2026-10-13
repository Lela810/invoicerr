import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '@mdx-js/mdx';
import { generatePost } from './changelog-post.mjs';

const release = (body) => ({ tag_name: 'v9.9.9', published_at: '2026-01-01T00:00:00Z', body });

async function assertCompiles(body) {
  const post = generatePost(release(body));
  const content = post.replace(/^---\n[\s\S]*?\n---\n/, '');
  await assert.doesNotReject(compile(content), post);
  return post;
}

const generatedNotes = [
  '<!-- Release notes generated using configuration in .github/release.yml at main -->',
  '',
  "## What's Changed",
  '### Features',
  '* feat: per-company default due date by @someone in https://github.com/invoicerr-app/invoicerr/pull/658',
  '### Fixes',
  '* fix(ci): accept the real 4xx rejection by @someone in https://github.com/invoicerr-app/invoicerr/pull/629',
  '',
  '**Full Changelog**: https://github.com/invoicerr-app/invoicerr/compare/v2.0.0-alpha.3...v2.0.0-alpha.4',
].join('\r\n');

test('GitHub generated notes, which open with an HTML comment', async () => {
  const post = await assertCompiles(generatedNotes);
  assert.doesNotMatch(post, /<!--/);
  assert.match(post, /## What's Changed/);
});

test('braces and angle brackets in a title stay literal', async () => {
  const post = await assertCompiles('* number series without {year} for Map<string, Rule> and a < b');
  assert.match(post, /\\\{year\\\}/);
  assert.match(post, /Map\\<string, Rule>/);
});

test('code keeps its content untouched', async () => {
  const body = ['Use `<Foo {...props} />` inline.', '', '```tsx', '<Bar x={1} />', '<!-- kept -->', '```'].join('\n');
  const post = await assertCompiles(body);
  assert.match(post, /`<Foo \{\.\.\.props\} \/>`/);
  assert.match(post, /<Bar x=\{1\} \/>\n<!-- kept -->/);
});

test('a multi-line HTML comment is removed', async () => {
  const post = await assertCompiles('before\n<!--\nhidden\n-->\nafter');
  assert.doesNotMatch(post, /hidden/);
});

test('the truncate marker never lands inside a code block', async () => {
  const lines = ['intro', '', '```', ...Array.from({ length: 12 }, (_, i) => `line ${i}`), '```', '', 'outro'];
  const post = await assertCompiles(lines.join('\n'));
  const [beforeMarker] = post.split('{/* truncate */}');
  assert.equal((beforeMarker.match(/^```/gm) ?? []).length % 2, 0);
});
