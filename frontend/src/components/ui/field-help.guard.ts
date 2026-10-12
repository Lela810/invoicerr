// Text-based so it runs in the unit test job without a TypeScript program.

export type DescriptionHit = { line: number; text: string }

// Lines that report live state next to a control, named by data-cy; every other muted line is a description.
const LIVE_STATUS = new Set(["client-language-suggested-hint", "import-document-csv-files-count"])

const TEXT_OPENING = /<(p|span|small|div)\b/g
const CONTROL =
  /^(input|textarea|select)$|(Input|Textarea|Select|SelectTrigger|Switch|Checkbox|Picker|RadioGroup|Slider|Combobox|Editor)$/
const LABEL_CLOSE = /<\/(FormControl|FormGroup|FormLabel|FieldLabel|Label)>$/
const EXPRESSION_OPENER = /(\{[^{}]*?(&&|\?|:)\s*\(?|\(|:)\s*$/
const TRAILING_COMMENT = /(\n[ \t]*\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\})$/
// A lock reason names itself: a key, a variable or a data-cy carrying "lock", in any colour.
const LOCK_REASON = /(^|[^A-Za-z])lock|Lock/

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function openingTagEnd(source: string, start: number): number {
  let depth = 0
  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (char === "{") depth++
    else if (char === "}") depth--
    else if (char === ">" && depth === 0) return i + 1
  }
  return source.length
}

function holdsControl(block: string): boolean {
  for (const tag of block.matchAll(/<([A-Za-z][\w.]*)/g)) {
    if (tag[1] === "FormControl" || tag[1] === "FormGroup" || CONTROL.test(tag[1])) return true
  }
  return false
}

function wrapperBefore(text: string): string | undefined {
  let depth = 0
  for (let end = text.length; end > 0; ) {
    const close = text.lastIndexOf("</div>", end - 1)
    const open = text.lastIndexOf("<div", end - 1)
    if (open < 0) return undefined
    if (close > open) {
      depth++
      end = close
    } else {
      depth--
      if (depth === 0) return text.slice(open)
      end = open
    }
  }
  return undefined
}

function previousSiblingIsField(before: string, labelledOnly = true): boolean {
  let text = before.trimEnd()
  for (let guard = 0; guard < 8; guard++) {
    const stripped = text.replace(EXPRESSION_OPENER, "").replace(TRAILING_COMMENT, "").trimEnd()
    if (stripped === text) break
    text = stripped
  }
  if (LABEL_CLOSE.test(text)) return true
  const closing = text.match(/<\/([A-Za-z][\w.]*)>$/)
  if (closing) {
    if (CONTROL.test(closing[1])) return true
    if (closing[1] !== "div") return false
    const wrapper = wrapperBefore(text)
    if (!wrapper || !holdsControl(wrapper)) return false
    if (!labelledOnly) return true
    // Only a labelled wrapper is a field; a toolbar holding a control is not.
    return /<\/(FormLabel|FieldLabel|Label)>$/.test(text.slice(0, text.length - wrapper.length).trimEnd())
  }
  if (!text.endsWith("/>")) return false
  const selfClosing = text.match(/<([A-Za-z][\w.]*)\b(?:[^<]|<(?![A-Za-z/]))*\/>$/)
  return !!selfClosing && CONTROL.test(selfClosing[1])
}

function insideFormItemOutsideControl(before: string): boolean {
  const openItems = count(before, /<FormItem\b/g) - count(before, /<\/FormItem>/g)
  const openControls =
    count(before, /<(FormControl|FormGroup)\b/g) - count(before, /<\/(FormControl|FormGroup)>/g)
  const openLabels =
    count(before, /<(FormLabel|FieldLabel)\b/g) - count(before, /<\/(FormLabel|FieldLabel)>/g)
  return openItems > 0 && openControls <= 0 && openLabels <= 0
}

// A unit, separator or short marker beside a control is part of the row, not a description.
function isAdornment(content: string): boolean {
  const text = content.trim()
  return !text.includes("{") && text.length <= 4
}

// A hidden element holding a single self-closing child, such as a loader icon, renders no text.
function isHiddenIcon(openingTag: string, content: string): boolean {
  const child = content.trim()
  return (
    /\saria-hidden(="true"|=\{true\})?[\s/>]/.test(openingTag) &&
    child.startsWith("<") &&
    child.endsWith("/>") &&
    count(child, /</g) === 1
  )
}

// Muted text beside a field is a description; a lock reason is flagged in any colour, beside any control.
export function findDescriptionsUnderFields(source: string): DescriptionHit[] {
  const hits: DescriptionHit[] = []
  for (const match of source.matchAll(/<FormDescription\b/g)) {
    hits.push({ line: lineOf(source, match.index), text: "FormDescription" })
  }
  for (const match of source.matchAll(TEXT_OPENING)) {
    const tagEnd = openingTagEnd(source, match.index)
    const openingTag = source.slice(match.index, tagEnd)
    const closeAt = source.indexOf(`</${match[1]}>`, tagEnd)
    const content = source.slice(tagEnd, closeAt < 0 ? tagEnd : closeAt)
    const lockReason = !content.includes("<") && LOCK_REASON.test(openingTag + content)
    if (!lockReason && !/\btext-muted-foreground\b/.test(openingTag)) continue
    const dataCy = openingTag.match(/\bdata-cy="([^"]+)"/)?.[1]
    if (/\brole="status"/.test(openingTag) && dataCy && LIVE_STATUS.has(dataCy)) continue
    if (isAdornment(content) || isHiddenIcon(openingTag, content)) continue
    const before = source.slice(0, match.index)
    if (previousSiblingIsField(before, !lockReason) || insideFormItemOutsideControl(before)) {
      hits.push({ line: lineOf(source, match.index), text: openingTag.replace(/\s+/g, " ").slice(0, 80) })
    }
  }
  return hits
}
