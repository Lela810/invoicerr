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

  it("leaves live status lines and inline separators next to a control alone", () => {
    const source = `
      <input type="file" onChange={onFiles} />
      <p className="text-xs text-muted-foreground" role="status">{files_count}</p>
      <DatePicker value={from} />
      <span className="text-muted-foreground text-sm">-</span>
      <DatePicker value={to} />`
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
