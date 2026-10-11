import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const search = vi.hoisted(() => ({ state: { data: undefined as unknown, isFetching: false } }))
vi.mock("@/hooks/queries", () => ({
  useReferenceSearch: (entity: string | undefined) =>
    entity ? search.state : { data: undefined, isFetching: false },
}))

import { CatalogSearchInput } from "./catalog-search-input"

function Harness() {
  const [value, setValue] = useState("")
  return (
    <CatalogSearchInput
      entity="article"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onCatalogSelect={() => {}}
      data-cy="designation"
    />
  )
}

function typeQuery(text: string) {
  render(<Harness />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: text } })
  act(() => vi.advanceTimersByTime(300))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("CatalogSearchInput loading and empty states", () => {
  it("shows a loader once a search has been running for 150 ms", () => {
    search.state = { data: undefined, isFetching: true }
    typeQuery("Lo")
    expect(document.querySelector('[data-cy="designation-loading"]')).toBeNull()
    act(() => vi.advanceTimersByTime(150))
    expect(document.querySelector('[data-cy="designation-loading"]')).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-busy", "true")
  })

  it("never shows the loader for an answer already there", () => {
    search.state = { data: [{ id: "a", label: "Loader widget" }], isFetching: false }
    typeQuery("Lo")
    act(() => vi.advanceTimersByTime(500))
    expect(document.querySelector('[data-cy="designation-loading"]')).toBeNull()
    expect(screen.getByText("Loader widget")).toBeTruthy()
  })

  it("says when nothing matches", () => {
    search.state = { data: [], isFetching: false }
    typeQuery("zz")
    expect(document.querySelector('[data-cy="designation-no-match"]')).not.toBeNull()
  })
})
