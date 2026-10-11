import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import type { DocumentFieldDescriptor } from "@/components/documents/types"
import { Form } from "@/components/ui/form"

vi.mock("@/hooks/use-catalog-search", () => ({
  useCatalogSearch: () => ({ options: [], loading: false, noMatch: false }),
}))

import { ArrayField } from "./array-field"

const linesField: DocumentFieldDescriptor = {
  key: "lines",
  kind: "array",
  label: "Lines",
  readOnlyWhen: "linesFromSupplierXml",
  prefillFrom: { entity: "article", map: { description: "name" } },
  fields: [
    { key: "description", kind: "text", label: "Designation" },
    { key: "quantity", kind: "number", label: "Quantity" },
    { key: "discountPercent", kind: "number", label: "Discount %" },
    { key: "date", kind: "date", label: "Work date" },
  ],
}

function renderLines(values: Record<string, unknown>) {
  function Harness() {
    const methods = useForm({ defaultValues: values })
    return (
      <Form {...methods}>
        <ArrayField field={linesField} name="lines" />
      </Form>
    )
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  )
}

const LINE = { description: "Audit", quantity: 2, discountPercent: 10, date: "2026-10-01" }

describe("ArrayField: lines read from a supplier e-invoice", () => {
  it("cannot be edited, added to or removed from", () => {
    renderLines({ linesFromSupplierXml: true, lines: [LINE] })

    expect(screen.getByTestId("document-field-description-input")).toBeDisabled()
    for (const input of screen.getAllByRole("spinbutton")) expect(input).toBeDisabled()
    expect(screen.getByTestId("document-field-date-input")).toBeDisabled()
    expect(screen.getByTestId("document-field-lines-add-row")).toBeDisabled()
    expect(screen.getByTestId("document-field-lines-remove-row-0")).toBeDisabled()
    expect(screen.getByTestId("document-field-lines-read-only-note")).toBeInTheDocument()
  })

  it("stays editable without the flag", () => {
    renderLines({ lines: [LINE] })

    expect(screen.getByTestId("document-field-description-input")).not.toBeDisabled()
    expect(screen.getByTestId("document-field-lines-add-row")).not.toBeDisabled()
    expect(screen.queryByTestId("document-field-lines-read-only-note")).toBeNull()
  })
})
