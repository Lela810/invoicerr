/** The measured shape of a widget grid at one viewport width, kept so the next first load can draw
 *  skeletons of the same size. Heights only: never a figure, a label or anything read from the data. */
export interface WidgetLayout {
  width: number
  metrics: number[]
  rest: { kind: string; height: number }[]
}

const storageKey = (location: string) => `invoicerr-widget-layout:${location}`

function isLayout(value: unknown): value is WidgetLayout {
  const layout = value as WidgetLayout
  return (
    typeof layout?.width === "number" &&
    Array.isArray(layout.metrics) &&
    layout.metrics.every((height) => typeof height === "number") &&
    Array.isArray(layout.rest) &&
    layout.rest.every((item) => typeof item?.kind === "string" && typeof item.height === "number")
  )
}

export function readWidgetLayout(location: string, width: number): WidgetLayout | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(location)) ?? "null")
    return isLayout(parsed) && parsed.width === width ? parsed : null
  } catch {
    return null
  }
}

export function saveWidgetLayout(location: string, layout: WidgetLayout) {
  try {
    localStorage.setItem(storageKey(location), JSON.stringify(layout))
  } catch {
    // Without storage the next first load falls back to the generic skeleton.
  }
}
