import { createContext, type ReactNode, useContext } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const WidgetReloadingContext = createContext(false)

export const WidgetReloadingProvider = WidgetReloadingContext.Provider

export function useWidgetReloading() {
  return useContext(WidgetReloadingContext)
}

/** A widget's figures. While the widget reloads they are hidden, never shown stale, and a skeleton
 *  takes their exact place, so the card keeps its size. */
export function WidgetValue({ children, className }: { children: ReactNode; className?: string }) {
  const reloading = useWidgetReloading()
  return (
    <div data-slot="widget-value" className={cn("relative", className)}>
      {reloading && <Skeleton className="absolute inset-x-0 inset-y-0.5" />}
      <div className={cn(reloading && "invisible")}>{children}</div>
    </div>
  )
}
