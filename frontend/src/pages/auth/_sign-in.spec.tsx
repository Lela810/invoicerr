import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import LoginPage from "./sign-in"

vi.mock("@/lib/auth", () => ({ authClient: { signIn: { email: vi.fn(), social: vi.fn() } } }))

// Leading underscore keeps generouted from registering this file as a route.
function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this as Response
    },
  } as Response
}

type CanRegister = { allowed: boolean; requiresCode: boolean } | "pending" | "error"

function installFetchMock(canRegister: CanRegister) {
  const handlers: Record<string, unknown> = {
    "/api/health": { status: "ok" },
    "/api/legal/documents": { saasMode: false, demoMode: false, documents: [] },
    "/api/invitations/can-register": canRegister,
  }
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost")
    if (url.pathname === "/api/invitations/can-register" && canRegister === "pending") {
      return new Promise<Response>(() => {})
    }
    if (url.pathname === "/api/invitations/can-register" && canRegister === "error") {
      throw new Error("network down")
    }
    if (!(url.pathname in handlers)) throw new Error(`Unmocked fetch in test: ${url.pathname}`)
    return jsonResponse(handlers[url.pathname])
  })
  vi.stubGlobal("fetch", fn)
  return fn
}

function renderSignIn() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

const registrationSettled = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryState(["registration", "status"])?.status).not.toBe("pending"))

afterEach(() => vi.unstubAllGlobals())

describe("<LoginPage> sign-up link", () => {
  it("is offered while the server accepts new accounts", async () => {
    installFetchMock({ allowed: true, requiresCode: false })
    renderSignIn()

    expect(await screen.findByTestId("auth-signup-link")).toBeInTheDocument()
  })

  it("stays offered on an invitation-only instance, where a code still opens sign-up", async () => {
    installFetchMock({ allowed: false, requiresCode: true })
    renderSignIn()

    expect(await screen.findByTestId("auth-signup-link")).toBeInTheDocument()
  })

  it("is hidden once the server says sign-up is closed", async () => {
    installFetchMock({ allowed: false, requiresCode: false })
    const client = renderSignIn()

    await registrationSettled(client)
    expect(screen.queryByTestId("auth-signup-link")).not.toBeInTheDocument()
  })

  it("is not shown before the server has answered, so a closed instance never flashes it", async () => {
    installFetchMock("pending")
    renderSignIn()

    await screen.findByTestId("auth-card")
    expect(screen.queryByTestId("auth-signup-link")).not.toBeInTheDocument()
  })

  it("stays offered when the check fails: the server still refuses a closed sign-up itself", async () => {
    installFetchMock("error")
    const client = renderSignIn()

    await registrationSettled(client)
    expect(screen.getByTestId("auth-signup-link")).toBeInTheDocument()
  })
})
