import { useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useDocumentFormReadOnly } from "@/components/documents/document-form-readonly"
import { FormField, FormGroup, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useSelectableRows } from "@/hooks/queries"

import { useConditionallyRequired } from "./primitive-fields"
import type { FieldRendererProps } from "./registry"

/** The id `field.sourceField`'s current value names, whichever shape that sibling holds (a bare
 *  string for a single-target 'reference', `{ entity, id }` for a multi-target one) — undefined
 *  while nothing usable has been picked yet. */
function sourceIdFrom(value: unknown): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" && id.length > 0 ? id : undefined
  }
  return undefined
}

// Survives an unmount: the wizard can show the source and the selection on different steps.
const lastSourceByForm = new WeakMap<object, Map<string, string | undefined>>()

function lastSourcesOf(control: object): Map<string, string | undefined> {
  let sources = lastSourceByForm.get(control)
  if (!sources) {
    sources = new Map()
    lastSourceByForm.set(control, sources)
  }
  return sources
}

function hasSelection(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

/** A generic, descriptor-agnostic preview of one source row — this renderer never fetches the source
 *  TYPE's own descriptor (that would couple it to knowing what an "invoice line" looks like), so it
 *  just lists the row's own values in the order the source stored them. */
function previewRow(data: Record<string, unknown>): string {
  const parts = Object.values(data)
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value))
  return parts.join(" · ")
}

/**
 * Renders a 'rowSelection' field: a checklist of the CURRENT rows of whatever document
 * `field.sourceField` (a sibling 'reference' field on this same document) names, fetched LIVE through
 * GET /documents/types/:typeId/fields/:fieldKey/rows (useSelectableRows) every time this renders —
 * never a snapshot taken once and cached, because the whole point of this kind is to track a source
 * that can move (see the backend's row-selection/row-selection.ts, decision 3). A previously selected
 * id that the fetch no longer lists is shown as its own, explicit "no longer available" row rather
 * than silently dropped or rendered blank: the backend is what actually BLOCKS saving over it
 * (validateRowSelections) — this is what lets the user see why before they even try.
 */
export function RowSelectionField({ field, name, documentTypeId }: FieldRendererProps) {
  const { t } = useTranslation()
  const { control, watch, getValues, setValue } = useFormContext()
  const sourceValue = field.sourceField ? watch(field.sourceField) : undefined
  const sourceId = sourceIdFrom(sourceValue)
  // A credit note's own `correctedLines` is `requiredIfPresent: 'invoice'` (required once THIS same
  // sibling `sourceField` resolves, never unconditionally) — the star indicator has to track that,
  // not `field.required` alone, or it would simply never show once "invoice" stopped being mandatory.
  const required = useConditionallyRequired(field)
  const readOnly = useDocumentFormReadOnly()

  const { data, isLoading } = useSelectableRows(documentTypeId, field.key, sourceId)
  const rows = data?.rows ?? []

  // Every row of a newly picked source starts checked; a selection that came with the form is kept.
  const lastSources = lastSourcesOf(control)
  const lastSourceId = useRef(lastSources.has(name) ? lastSources.get(name) : sourceId)
  const selectAllFor = useRef(sourceId && !hasSelection(getValues(name)) ? sourceId : undefined)
  useEffect(() => {
    if (sourceId !== lastSourceId.current) {
      lastSourceId.current = sourceId
      selectAllFor.current = sourceId
    }
    lastSources.set(name, sourceId)
    if (!sourceId || selectAllFor.current !== sourceId || !data) return
    selectAllFor.current = undefined
    setValue(
      name,
      data.rows.map((row) => row.id),
      { shouldDirty: true, shouldValidate: true },
    )
  }, [sourceId, data, name, setValue, lastSources])

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: rhfField }) => {
        const selected: string[] = Array.isArray(rhfField.value) ? rhfField.value : []
        const missing = selected.filter((id) => !rows.some((row) => row.id === id))

        const toggle = (id: string, checked: boolean) => {
          rhfField.onChange(checked ? [...selected, id] : selected.filter((existing) => existing !== id))
        }

        return (
          <FormItem data-cy={`document-field-${field.key}`}>
            <FormLabel
              required={required}
              description={field.helpText}
              helpDataCy={`document-field-${field.key}-help`}
            >
              {field.label}
            </FormLabel>
            <FormGroup className="space-y-2 rounded-md border p-3">
              {!sourceId && (
                <p
                  className="text-sm text-muted-foreground"
                  data-cy={`document-field-${field.key}-no-source`}
                >
                  {t("documents.form.rowSelection.selectSourceFirst")}
                </p>
              )}
              {sourceId && isLoading && (
                <p className="text-sm text-muted-foreground">{t("documents.form.rowSelection.loading")}</p>
              )}
              {sourceId && !isLoading && rows.length === 0 && (
                <p className="text-sm text-muted-foreground" data-cy={`document-field-${field.key}-empty`}>
                  {t("documents.form.rowSelection.noRows")}
                </p>
              )}

              {rows.map((row) => (
                <label
                  key={row.id}
                  className="flex items-center gap-2 text-sm"
                  data-cy={`document-field-${field.key}-row-${row.id}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selected.includes(row.id)}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                    disabled={readOnly}
                    data-cy={`document-field-${field.key}-row-${row.id}-checkbox`}
                  />
                  <span>{previewRow(row.data)}</span>
                </label>
              ))}

              {missing.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md border border-dashed border-destructive/50 p-2 text-sm text-destructive"
                  data-cy={`document-field-${field.key}-missing-${id}`}
                >
                  <span>{t("documents.form.rowSelection.missingRow")}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle(id, false)}
                    disabled={readOnly}
                    dataCy={`document-field-${field.key}-missing-${id}-remove`}
                  >
                    {t("documents.form.rowSelection.removeMissing")}
                  </Button>
                </div>
              ))}
            </FormGroup>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
