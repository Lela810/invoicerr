import { useEffect, useState } from "react"

/** `flag`, but only once it has stayed true for `delayMs`, so a short-lived state never flashes. */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false)

  useEffect(() => {
    if (!flag) {
      setDelayed(false)
      return
    }
    const timer = setTimeout(() => setDelayed(true), delayMs)
    return () => clearTimeout(timer)
  }, [flag, delayMs])

  return flag && delayed
}
