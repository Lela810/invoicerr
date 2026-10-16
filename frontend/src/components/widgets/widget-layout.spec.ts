import { afterEach, describe, expect, it, vi } from "vitest"

import { readWidgetLayout, saveWidgetLayout } from "./widget-layout"

const layout = {
  width: 720,
  metrics: [144, 144, 144, 144, 142],
  rest: [
    { kind: "timeSeries", height: 322 },
    { kind: "table", height: 410 },
  ],
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("widget layout memory", () => {
  it("gives back the layout last saved for the same location and width", () => {
    saveWidgetLayout("dashboard", layout)
    expect(readWidgetLayout("dashboard", 720)).toEqual(layout)
  })

  it("forgets a layout measured at another width, where every height differs", () => {
    saveWidgetLayout("dashboard", layout)
    expect(readWidgetLayout("dashboard", 390)).toBeNull()
  })

  it("keeps each location's layout apart", () => {
    saveWidgetLayout("dashboard", layout)
    expect(readWidgetLayout("statistics", 720)).toBeNull()
  })

  it("ignores a stored value that is not a layout", () => {
    localStorage.setItem("invoicerr-widget-layout:dashboard", '{"width":720,"metrics":"nope"}')
    expect(readWidgetLayout("dashboard", 720)).toBeNull()
  })

  it("works without storage at all", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(() => saveWidgetLayout("dashboard", layout)).not.toThrow()
    expect(readWidgetLayout("dashboard", 720)).toBeNull()
  })
})
