import { routes } from "@generouted/react-router/lazy"
import { useEffect } from "react"

import { queryClient } from "@/lib/query-client"
import { prefetchRoutesWhenIdle } from "@/lib/route-prefetch"

const isPageBusy = () => document.readyState !== "complete" || queryClient.isFetching() > 0

export function useRoutePrefetch() {
  useEffect(() => prefetchRoutesWhenIdle(routes, { isBusy: isPageBusy }), [])
}
