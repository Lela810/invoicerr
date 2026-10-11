import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

import { findDescriptionsUnderFields } from "./field-help.guard"

const SRC = join(__dirname, "..", "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx$/.test(name) && !/\.spec\.tsx$/.test(name) ? [path] : []
  })
}

describe("field descriptions guard", () => {
  it("flags the removed FormDescription component", () => {
    expect(findDescriptionsUnderFields("<FormDescription>{x}</FormDescription>")).toHaveLength(1)
  })

  it("flags muted helper text right after a field control", () => {
    const afterControl = `
      <FormControl>
        <Input {...field} />
      </FormControl>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}`
    const afterInput = `
      <Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} />
      <p className="text-xs text-muted-foreground">{rate_hint}</p>`
    const afterLabel = `
      <Label>{field.label}</Label>
      {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}`
    expect(findDescriptionsUnderFields(afterControl)).toHaveLength(1)
    expect(findDescriptionsUnderFields(afterInput)).toHaveLength(1)
    expect(findDescriptionsUnderFields(afterLabel)).toHaveLength(1)
  })

  it("flags muted text anywhere in a FormItem outside its control", () => {
    const source = `
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormMessage />
        <span className="text-xs text-muted-foreground">{name_hint}</span>
      </FormItem>`
    expect(findDescriptionsUnderFields(source)).toHaveLength(1)
  })

  it("leaves section intros, empty states and a control's own content alone", () => {
    const source = `
      <SettingsSection title="Payments">
        <p className="text-sm text-muted-foreground">{payments_intro}</p>
      </SettingsSection>
      <FormItem>
        <FormLabel description={files_help}>Files</FormLabel>
        <FormControl>
          <div>
            <span className="text-xs text-muted-foreground">{files_maxSize}</span>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{rows_empty}</p>}`
    expect(findDescriptionsUnderFields(source)).toEqual([])
  })

  it("leaves the allow-listed live status lines and inline separators alone", () => {
    const source = `
      <input type="file" onChange={onFiles} />
      <p className="text-xs text-muted-foreground" role="status" data-cy="import-document-csv-files-count">{files_count}</p>
      <DatePicker value={from} />
      <span className="text-muted-foreground text-sm">-</span>
      <DatePicker value={to} />`
    expect(findDescriptionsUnderFields(source)).toEqual([])
  })

  it.each([
    [
      "a role=status line that is not allow-listed",
      `<Input id="x" />
      <p className="text-xs text-muted-foreground" role="status">{x_hint}</p>`,
    ],
    [
      "a paragraph after a wrapper holding the input",
      `<Label htmlFor="uri">{uri_label}</Label>
      <div className="flex gap-2">
        <Input id="uri" readOnly value={uri} />
        <Button onClick={copy}>{copy_label}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{uri_hint}</p>`,
    ],
    [
      "a paragraph after a Radix select",
      `<Select value={v} onValueChange={setV}>
        <SelectTrigger id="mode"><SelectValue /></SelectTrigger>
      </Select>
      <p className="text-xs text-muted-foreground">{mode_hint}</p>`,
    ],
    [
      "a span after an input",
      `<Input id="days" />
      <span className="text-xs text-muted-foreground">{days_hint}</span>`,
    ],
    [
      "a small after an input",
      `<Input id="days" />
      <small className="text-muted-foreground">{days_hint}</small>`,
    ],
    [
      "a class built with a template literal",
      `<Input id="days" />
      <p className={\`\${size} text-muted-foreground\`}>{days_hint}</p>`,
    ],
  ])("flags %s", (_case, source) => {
    expect(findDescriptionsUnderFields(source)).toHaveLength(1)
  })

  it.each([
    [
      "muted text inside a FormControl that carries a className",
      `<FormItem>
        <FormLabel>Date</FormLabel>
        <FormControl className="w-full">
          <div><span className="text-xs text-muted-foreground">{date_format}</span></div>
        </FormControl>
      </FormItem>`,
    ],
    [
      "an (optional) marker inside the label",
      `<FormItem>
        <FormLabel>{name_label} <span className="text-muted-foreground">{optional_label}</span></FormLabel>
        <FormControl><Input {...field} /></FormControl>
      </FormItem>`,
    ],
    [
      "a unit suffix next to the control",
      `<FormItem>
        <FormLabel>{rate_label}</FormLabel>
        <div className="flex items-center gap-2">
          <FormControl><Input {...field} /></FormControl>
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </FormItem>`,
    ],
    [
      "an empty state after a component whose name ends in Field",
      `<DocumentField field={f} name={n} />
      <p className="text-sm text-muted-foreground">{rows_empty}</p>`,
    ],
    [
      "a note after a toolbar that holds a control but no label",
      `<div className="flex gap-2">
        <Select value={period} onValueChange={setPeriod}><SelectTrigger /></Select>
        <Button onClick={exportReport}>{export_label}</Button>
      </div>
      {report && <p className="text-xs text-muted-foreground">{report_note}</p>}`,
    ],
  ])("leaves %s alone", (_case, source) => {
    expect(findDescriptionsUnderFields(source)).toEqual([])
  })

  it("finds no description rendered under a field anywhere in the app", () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => !path.endsWith("field-help.guard.ts"))
      .flatMap((path) =>
        findDescriptionsUnderFields(readFileSync(path, "utf8")).map(
          (hit) => `${relative(SRC, path)}:${hit.line}: ${hit.text}`,
        ),
      )
    expect(
      offenders,
      "Field descriptions go in the label's help popover: <FormLabel description={...}> or <FieldLabel>.",
    ).toEqual([])
  })
})
