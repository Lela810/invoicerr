/**
 * Source scan behind field-help.guard.spec.ts: a field's description belongs in its label's `?`
 * help (field-help.tsx), never as muted text under the field. Text-based on purpose, so it runs in
 * the unit test job without a TypeScript program.
 */

export type DescriptionHit = { line: number; text: string }

const MUTED_TEXT = /<(p|span|div)\b[^>]*?className=(?:"[^"]*|\{[^}]*?)\btext-muted-foreground/g
const FIELD_CONTROL =
  /(Input|Textarea|Select|Switch|Checkbox|Picker|RadioGroup|Slider|Combobox|Editor|Field)$|^(input|textarea|select)$/
const EXPRESSION_OPENER = /(\{[^{}]*?(&&|\?|:)\s*\(?|\(|:)\s*$/

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function previousSiblingIsField(before: string): boolean {
  let text = before.trimEnd()
  for (let guard = 0; guard < 4; guard++) {
    const stripped = text.replace(EXPRESSION_OPENER, "").trimEnd()
    if (stripped === text) break
    text = stripped
  }
  if (/<\/(FormControl|FormLabel|Label)>$/.test(text)) return true
  if (!text.endsWith("/>")) return false
  const selfClosing = text.match(/<([A-Za-z][\w.]*)\b(?:[^<]|<(?![A-Za-z/]))*\/>$/)
  return !!selfClosing && FIELD_CONTROL.test(selfClosing[1])
}

function insideFormItemOutsideControl(before: string): boolean {
  const openItems = count(before, /<FormItem\b/g) - count(before, /<\/FormItem>/g)
  const openControls = count(before, /<FormControl>/g) - count(before, /<\/FormControl>/g)
  return openItems > 0 && openControls <= 0
}

export function findDescriptionsUnderFields(source: string): DescriptionHit[] {
  const hits: DescriptionHit[] = []
  for (const match of source.matchAll(/<\/?FormDescription\b/g)) {
    if (match[0].startsWith("</")) continue
    hits.push({ line: lineOf(source, match.index), text: "FormDescription" })
  }
  for (const match of source.matchAll(MUTED_TEXT)) {
    const openingTag = source.slice(match.index, source.indexOf(">", match.index + match[0].length) + 1)
    if (/\brole="status"|\baria-live=/.test(openingTag)) continue
    const before = source.slice(0, match.index)
    const isParagraph = match[1] === "p"
    if ((isParagraph && previousSiblingIsField(before)) || insideFormItemOutsideControl(before)) {
      hits.push({ line: lineOf(source, match.index), text: match[0].slice(0, 80) })
    }
  }
  return hits
}
