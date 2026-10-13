// Release notes are GitHub markdown, but the blog compiles them as MDX, where `{`, `<` and HTML
// comments are syntax. Outside code they are made literal (comments dropped, as GitHub hides
// them anyway); inside code MDX already treats them literally.
export function toMdxSafe(markdown) {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/<!--[\s\S]*?-->\n?/g, '').replace(/[{}<]/g, (c) => `\\${c}`),
    )
    .join('');
}

const SUMMARY_LINES = 10;

function truncateIndex(lines) {
  let fences = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i >= SUMMARY_LINES && fences % 2 === 0) return i;
    if (lines[i].startsWith('```')) fences++;
  }
  return lines.length;
}

export function generatePost(release) {
  const date = release.published_at?.split('T')[0] ?? 'Unknown date';
  const raw = (release.body ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const body = toMdxSafe(raw).trim();

  const frontmatter = [
    '---',
    `title: ${release.tag_name}`,
    `date: ${date}`,
    'tags: [release]',
    '---',
  ].join('\n');

  const lines = body.split('\n');
  const cut = truncateIndex(lines);
  if (cut >= lines.length) {
    return `${frontmatter}\n\n${body}\n`;
  }

  const before = lines.slice(0, cut).join('\n');
  const after = lines.slice(cut).join('\n');
  return `${frontmatter}\n\n${before}\n\n{/* truncate */}\n\n${after}\n`;
}
