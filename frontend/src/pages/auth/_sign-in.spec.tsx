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

function installFetchMock(canRegister: { allowed: boolean; requiresCode: boolean }) {
  const handlers: Record<string, unknown> = {
    "/api/health": { status: "ok" },
    "/api/legal/documents": { saasMode: false, demoMode: false, documents: [] },
    "/api/invitations/can-register": canRegister,
  }
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost")
    if (!(url.pathname in handlers)) throw new Error(`Unmocked fetch in test: ${url.pathname}`)
    return jsonResponse(handlers[url.pathname])
  })
  vi.stubGlobal("fetch", fn)
  return fn
}

function renderSignIn() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

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
    const fetchMock = installFetchMock({ allowed: false, requiresCode: false })
    renderSignIn()

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/api/invitations/can-register")),
      ).toBe(true),
    )
    await waitFor(() => expect(screen.queryByTestId("auth-signup-link")).not.toBeInTheDocument())
  })
})
