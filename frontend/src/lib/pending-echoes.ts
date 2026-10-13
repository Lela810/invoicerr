/**
 * Tells the echo of a value this component sent (to the URL, say) apart from a change made
 * elsewhere. Several sends can be outstanding at once, and their echoes arrive in order.
 */
export function createPendingEchoes<T>() {
  let outstanding: T[] = []
  return {
    sent(value: T) {
      outstanding.push(value)
    },
    /** True for an echo of an outstanding send; anything else clears what was outstanding. */
    isEcho(value: T) {
      const index = outstanding.indexOf(value)
      outstanding = index === -1 ? [] : outstanding.slice(index + 1)
      return index !== -1
    },
  }
}
