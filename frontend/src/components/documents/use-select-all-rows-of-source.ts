import { useEffect, useMemo } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

import type { DocumentFieldDescriptor } from "@/components/documents/types"
import { useFetchSelectableRows } from "@/hooks/queries"

/** The id a 'reference' value names, whichever shape it holds (a bare string for a single-target
 *  field, `{ entity, id }` for a multi-target one); undefined while nothing usable is picked. */
export function sourceIdFrom(value: unknown): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" && id.length > 0 ? id : undefined
  }
  return undefined
}

/**
 * Every 'rowSelection' field starts with all rows of its source checked: when the source is picked
 * or changed, and on a form that opens with a source but no selection. Lives at form level so it
 * holds whichever step, if any, renders the selection.
 */
export function useSelectAllRowsOfSource(
  form: UseFormReturn<FieldValues>,
  typeId: string,
  fields: DocumentFieldDescriptor[],
) {
  const fetchSelectableRows = useFetchSelectableRows()
  const selections = useMemo(
    () =>
      fields.filter((field): field is DocumentFieldDescriptor & { sourceField: string } => {
        return field.kind === "rowSelection" && !!field.sourceField
      }),
    [fields],
  )

  useEffect(() => {
    if (selections.length === 0) return

    const selectAll = async (key: string, sourceField: string, sourceId: string) => {
      try {
        const { rows } = await fetchSelectableRows(typeId, key, sourceId)
        if (sourceIdFrom(form.getValues(sourceField)) !== sourceId) return
        form.setValue(
          key,
          rows.map((row) => row.id),
          { shouldDirty: true, shouldValidate: true },
        )
      } catch {
        // The field's own query shows the failure.
      }
    }

    const lastSourceIds = new Map<string, string | undefined>()
    for (const { key, sourceField } of selections) {
      const sourceId = sourceIdFrom(form.getValues(sourceField))
      lastSourceIds.set(key, sourceId)
      const selected = form.getValues(key)
      if (sourceId && !(Array.isArray(selected) && selected.length > 0))
        void selectAll(key, sourceField, sourceId)
    }

    const subscription = form.watch((values, info) => {
      for (const { key, sourceField } of selections) {
        if (info.name !== undefined && info.name !== sourceField) continue
        const sourceId = sourceIdFrom((values as Record<string, unknown>)[sourceField])
        const changed = sourceId !== lastSourceIds.get(key)
        lastSourceIds.set(key, sourceId)
        // A reset (no field name) restores a stored selection along with its source.
        if (!changed || info.name === undefined) continue
        if (sourceId) void selectAll(key, sourceField, sourceId)
        else form.setValue(key, [], { shouldDirty: true, shouldValidate: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [form, fetchSelectableRows, typeId, selections])
}
