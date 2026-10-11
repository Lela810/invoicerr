import { fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

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

  it("opens on mouse hover and closes when the pointer leaves", () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.pointerEnter(trigger)
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
    fireEvent.pointerLeave(trigger)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens when the help button receives keyboard focus", () => {
    render(<VatRateForm />)
    const trigger = screen.getByRole("button", { name: /help/i })
    fireEvent.keyDown(document.body, { key: "Tab" })
    fireEvent.focus(trigger)
    expect(screen.getByRole("dialog")).toHaveTextContent(HELP)
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
