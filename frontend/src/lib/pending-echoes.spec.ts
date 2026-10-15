import { describe, expect, it } from "vitest"

import { createPendingEchoes } from "@/lib/pending-echoes"

describe("createPendingEchoes", () => {
  it("recognises the echo of the value just sent", () => {
    const echoes = createPendingEchoes<string | undefined>()
    echoes.sent("Zz")
    expect(echoes.isEcho("Zz")).toBe(true)
  })

  it("recognises an older echo arriving after a newer value was already sent", () => {
    const echoes = createPendingEchoes<string | undefined>()
    echoes.sent("Zz")
    echoes.sent("Zzy")
    expect(echoes.isEcho("Zz")).toBe(true)
    expect(echoes.isEcho("Zzy")).toBe(true)
  })

  it("treats a value never sent as an external change, and forgets what was outstanding", () => {
    const echoes = createPendingEchoes<string | undefined>()
    echoes.sent("Zz")
    expect(echoes.isEcho(undefined)).toBe(false)
    expect(echoes.isEcho("Zz")).toBe(false)
  })

  it("treats a value seen again after its echo as an external change", () => {
    const echoes = createPendingEchoes<string | undefined>()
    echoes.sent("acme")
    expect(echoes.isEcho("acme")).toBe(true)
    expect(echoes.isEcho("acme")).toBe(false)
  })

  it("drops the values sent before an echo, which the URL has moved past", () => {
    const echoes = createPendingEchoes<string | undefined>()
    echoes.sent("a")
    echoes.sent("ab")
    expect(echoes.isEcho("ab")).toBe(true)
    expect(echoes.isEcho("a")).toBe(false)
  })
})
