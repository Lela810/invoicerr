import type { RouteObject } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { prefetchRoutesWhenIdle } from "./route-prefetch"

let idleCallbacks: IdleRequestCallback[] = []

function runIdle() {
  const pending = idleCallbacks
  idleCallbacks = []
  for (const callback of pending) callback({ didTimeout: false, timeRemaining: () => 50 })
}

async function settle() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
    runIdle()
  }
}

function lazyRoute(children?: RouteObject[]) {
  return { lazy: vi.fn(() => Promise.resolve({})), children } as RouteObject & {
    lazy: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  idleCallbacks = []
  vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
    idleCallbacks.push(callback)
    return idleCallbacks.length
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("prefetchRoutesWhenIdle", () => {
  it("loads nothing before the browser is idle, then every lazy route, nested ones included", async () => {
    const child = lazyRoute()
    const layout = lazyRoute([child])
    const page = lazyRoute()

    prefetchRoutesWhenIdle([{ children: [layout, page] }])
    await Promise.resolve()
    expect(layout.lazy).not.toHaveBeenCalled()

    await settle()
    expect(layout.lazy).toHaveBeenCalledOnce()
    expect(page.lazy).toHaveBeenCalledOnce()
    expect(child.lazy).toHaveBeenCalledOnce()
  })

  it("keeps at most two loads in flight and starts with the shallowest routes", async () => {
    const resolvers: Array<() => void> = []
    const order: string[] = []
    const pending = (name: string, children?: RouteObject[]): RouteObject => ({
      children,
      lazy: () => {
        order.push(name)
        return new Promise<Record<string, never>>((resolve) => resolvers.push(() => resolve({})))
      },
    })
    const routes = [
      { children: [pending("layout", [pending("nested")]), pending("dashboard"), pending("statistics")] },
    ]

    prefetchRoutesWhenIdle(routes)
    await settle()
    expect(order).toEqual(["layout", "dashboard"])

    resolvers[0]()
    await settle()
    expect(order).toEqual(["layout", "dashboard", "statistics"])

    resolvers[1]()
    resolvers[2]()
    await settle()
    expect(order).toEqual(["layout", "dashboard", "statistics", "nested"])
  })

  it.each([
    ["Save-Data is on", { saveData: true, effectiveType: "4g" }],
    ["the connection is 2g", { saveData: false, effectiveType: "2g" }],
    ["the connection is slow-2g", { saveData: false, effectiveType: "slow-2g" }],
  ])("loads nothing when %s", async (_, connection) => {
    vi.stubGlobal("navigator", { ...navigator, connection })
    const page = lazyRoute()

    prefetchRoutesWhenIdle([page])
    await settle()

    expect(page.lazy).not.toHaveBeenCalled()
  })

  it("swallows a failed load and goes on with the next routes", async () => {
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    const failing: RouteObject = { lazy: () => Promise.reject(new Error("chunk gone")) }
    const throwing: RouteObject = {
      lazy: () => {
        throw new Error("sync failure")
      },
    }
    const pages = [lazyRoute(), lazyRoute()]

    prefetchRoutesWhenIdle([failing, throwing, ...pages])
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off("unhandledRejection", unhandled)

    expect(pages[0].lazy).toHaveBeenCalledOnce()
    expect(pages[1].lazy).toHaveBeenCalledOnce()
    expect(unhandled).not.toHaveBeenCalled()
  })

  it("falls back to a timer where requestIdleCallback does not exist", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("requestIdleCallback", undefined)
    const page = lazyRoute()

    prefetchRoutesWhenIdle([page])
    await vi.advanceTimersByTimeAsync(500)
    expect(page.lazy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)
    expect(page.lazy).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("waits while the current page still has requests in flight", async () => {
    vi.useFakeTimers()
    let busy = true
    const pages = [lazyRoute(), lazyRoute()]

    prefetchRoutesWhenIdle(pages, { isBusy: () => busy })
    runIdle()
    await vi.advanceTimersByTimeAsync(5000)
    runIdle()
    expect(pages[0].lazy).not.toHaveBeenCalled()

    busy = false
    await vi.advanceTimersByTimeAsync(5000)
    await settle()
    expect(pages[0].lazy).toHaveBeenCalledOnce()
    expect(pages[1].lazy).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("starts no further load once cancelled", async () => {
    const pages = [lazyRoute(), lazyRoute(), lazyRoute()]

    const cancel = prefetchRoutesWhenIdle(pages)
    runIdle()
    cancel()
    await settle()

    expect(pages[0].lazy).toHaveBeenCalledOnce()
    expect(pages[1].lazy).toHaveBeenCalledOnce()
    expect(pages[2].lazy).not.toHaveBeenCalled()
  })

  it("prefetches on a 3g connection", async () => {
    vi.stubGlobal("navigator", { ...navigator, connection: { saveData: false, effectiveType: "3g" } })
    const page = lazyRoute()

    prefetchRoutesWhenIdle([page])
    await settle()

    expect(page.lazy).toHaveBeenCalledOnce()
  })
})
