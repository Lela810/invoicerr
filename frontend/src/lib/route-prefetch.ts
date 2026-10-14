import type { RouteObject } from "react-router"

type Loader = () => unknown

function collectLoaders(routes: RouteObject[]): Loader[] {
  const loaders: Loader[] = []
  let level = routes
  while (level.length > 0) {
    for (const route of level) if (typeof route.lazy === "function") loaders.push(route.lazy as Loader)
    level = level.flatMap((route) => route.children ?? [])
  }
  return loaders
}

const CONCURRENCY = 2
const FALLBACK_DELAY_MS = 1000
const BUSY_RETRY_MS = 1000
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g"])

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

function isConstrained(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  return !!connection?.saveData || SLOW_CONNECTIONS.has(connection?.effectiveType ?? "")
}

function whenIdle(callback: () => void) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(callback)
  else setTimeout(callback, FALLBACK_DELAY_MS)
}

type Options = { isBusy?: () => boolean }

export function prefetchRoutesWhenIdle(routes: RouteObject[], { isBusy = () => false }: Options = {}) {
  const queue = isConstrained() ? [] : collectLoaders(routes)
  const next = () => {
    if (queue.length === 0) return
    if (isBusy()) {
      setTimeout(() => whenIdle(next), BUSY_RETRY_MS)
      return
    }
    const load = queue.shift()!
    // A failed prefetch only means the page loads on click, as without prefetch.
    Promise.resolve()
      .then(load)
      .catch(() => {})
      .finally(() => whenIdle(next))
  }
  whenIdle(() => {
    for (let i = 0; i < CONCURRENCY; i++) next()
  })
  return () => {
    queue.length = 0
  }
}
