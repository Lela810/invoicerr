import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type * as React from "react"
import { FormProvider, useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { FieldLabel, fieldHelpId } from "@/components/ui/field-help"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import CountrySelect from "@/components/country-select"
import CurrencySelect from "@/components/currency-select"
import SearchSelect from "@/components/search-input"
import DocumentLanguageSelect from "@/components/document-language-select"
import { FileField } from "@/components/documents/field-renderers/file-field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const HELP = "The rate applied to this line, taken from your country's VAT catalog."

function VatRateForm({ error }: { error?: string }) {
  const form = useForm({ defaultValues: { vatRate: "" } })
  if (error && !form.formState.errors.vatRate) form.setError("vatRate", { message: error })
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="vatRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel required description={HELP}>
              VAT rate
            </FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}

describe("<FormLabel description>", () => {
  it("reads 'Name *' and keeps the description out of sight until asked for", () => {
    render(<VatRateForm />)
    expect(screen.getByText("VAT rate").closest("label")).toHaveTextContent(/^VAT rate\s*\*$/)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("describes the input with the help text", () => {
    render(<VatRateForm />)
    expect(screen.getByRole("textbox", { name: /VAT rate/ })).toHaveAccessibleDescription(HELP)
  })

  it("offers a focusable help button that opens the description on click or tap", () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    expect(trigger).not.toHaveAttribute("tabindex", "-1")
    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
  })

  it("closes on a second tap, on Escape and on a press outside", async () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })

    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(trigger)
    // Radix arms its outside-press listener one macrotask after the layer mounts.
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens on mouse hover and closes when the pointer leaves", async () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.pointerEnter(trigger)
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
    fireEvent.pointerLeave(trigger)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("stays open while the pointer moves from the help button onto its text", async () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.pointerEnter(trigger)
    const content = screen.getByRole("dialog")
    fireEvent.pointerLeave(trigger)
    fireEvent.pointerEnter(content)
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
    fireEvent.pointerLeave(content)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes a hovered help on Escape", () => {
    render(<VatRateForm />)
    fireEvent.pointerEnter(screen.getByRole("button", { name: /help/i }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("never moves focus when a hover opens and closes the help", async () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.pointerEnter(trigger)
    fireEvent.pointerLeave(trigger)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(document.activeElement).toBe(document.body)
  })

  it("opens when the help button receives keyboard focus", () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.keyDown(document.body, { key: "Tab" })
    act(() => trigger.focus())
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
  })

  it("stays closed when focus lands on it after a key other than Tab", () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.keyDown(document.body, { key: "Escape" })
    act(() => trigger.focus())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("still renders a validation error under the field", () => {
    render(<VatRateForm error="Pick a rate" />)
    const message = screen.getByText("Pick a rate")
    expect(message.tagName).toBe("P")
    expect(screen.getByRole("textbox", { name: /VAT rate/ })).toHaveAccessibleDescription(
      `${HELP} Pick a rate`,
    )
  })
})

function DescribedControl({
  children,
}: {
  children: (field: { value: unknown; onChange: (v: unknown) => void }) => React.ReactNode
}) {
  const form = useForm({ defaultValues: { value: "" } })
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem>
            <FormLabel description={HELP}>Picked value</FormLabel>
            {children(field)}
          </FormItem>
        )}
      />
    </Form>
  )
}

describe("every kind of control is labelled and described by its field help", () => {
  it("a Radix select, with FormControl around its trigger", () => {
    render(
      <DescribedControl>
        {(field) => (
          <Select value={field.value as string} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="a">A</SelectItem>
            </SelectContent>
          </Select>
        )}
      </DescribedControl>,
    )
    expect(screen.getByLabelText("Picked value")).toHaveAccessibleDescription(HELP)
  })

  it.each([
    ["CountrySelect", CountrySelect],
    ["CurrencySelect", CurrencySelect],
    ["DocumentLanguageSelect", DocumentLanguageSelect],
  ] as const)("%s", (_name, Control) => {
    render(
      <DescribedControl>
        {(field) => (
          <FormControl>
            <Control value={field.value as string} onChange={field.onChange} />
          </FormControl>
        )}
      </DescribedControl>,
    )
    expect(screen.getByLabelText("Picked value")).toHaveAccessibleDescription(HELP)
  })

  it("a document file field", () => {
    function FileForm() {
      const form = useForm({ defaultValues: { receipt: undefined } })
      return (
        <QueryClientProvider client={new QueryClient()}>
          <FormProvider {...form}>
            <FileField
              field={{ key: "receipt", kind: "file", label: "Receipt", required: false, helpText: HELP }}
              name="receipt"
              documentTypeId="expense"
            />
          </FormProvider>
        </QueryClientProvider>
      )
    }
    render(<FileForm />)
    expect(screen.getByRole("group", { name: "Receipt" })).toHaveAccessibleDescription(HELP)
  })
})

describe("<FieldLabel> outside a form", () => {
  it("derives the description id from htmlFor", () => {
    render(
      <>
        <FieldLabel htmlFor="pattern" description={HELP}>
          Pattern
        </FieldLabel>
        <input id="pattern" aria-describedby={fieldHelpId("pattern")} />
      </>,
    )
    expect(screen.getByLabelText("Pattern")).toHaveAccessibleDescription(HELP)
  })

  it("still offers the help when the label points at nothing", () => {
    render(<FieldLabel description={HELP}>Lines</FieldLabel>)
    fireEvent.click(screen.getByRole("button", { name: /help/i }))
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
  })
})

describe("SearchSelect inside a form field", () => {
  function SupplierForm({ error }: { error?: string }) {
    const form = useForm({ defaultValues: { supplier: "" } })
    if (error && !form.formState.errors.supplier) form.setError("supplier", { message: error })
    return (
      <Form {...form}>
        <FormField
          control={form.control}
          name="supplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={HELP}>Linked supplier</FormLabel>
              <FormControl>
                <SearchSelect
                  options={[{ label: "Acme", value: "acme" }]}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    )
  }

  it("is the labelled, described control of its field", () => {
    render(<SupplierForm />)
    const trigger = screen.getByLabelText("Linked supplier")
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger).toHaveAccessibleDescription(HELP)
  })

  it("opens its options when the label is clicked", () => {
    render(<SupplierForm />)
    fireEvent.click(screen.getByText("Linked supplier"))
    expect(screen.getByText("Acme")).toBeInTheDocument()
  })

  it("marks its trigger invalid when the field has an error", () => {
    render(<SupplierForm error="Pick a supplier" />)
    expect(screen.getByLabelText("Linked supplier")).toHaveAttribute("aria-invalid", "true")
  })
})
