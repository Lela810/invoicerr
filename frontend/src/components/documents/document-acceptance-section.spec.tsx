import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DocumentAcceptanceSection } from "@/components/documents/document-acceptance-section"
import { queryClient as appQueryClient } from "@/lib/query-client"

const MANIFEST = {
  kind: "manual-acceptance",
  documentId: "q-1",
  actorId: "u-1",
  actorName: "John Doe",
  actorEmail: "john.doe@acme.org",
  note: "Accepted by phone",
  acceptedAt: "2026-01-15T10:00:00.000Z",
}

/** The backend replies to "no manual acceptance" with `null`, which goes out as a 200 with an empty body. */
function emptyOk() {
  return new Response("", { status: 200 })
}

function manifestOk() {
  return new Response(JSON.stringify(MANIFEST), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function newClient() {
  const defaults = appQueryClient.getDefaultOptions()
  return new QueryClient({ defaultOptions: { ...defaults, queries: { ...defaults.queries, retryDelay: 5 } } })
}

function renderSection(client: QueryClient, status: string) {
  const tree = (current: string) => (
    <QueryClientProvider client={client}>
      <DocumentAcceptanceSection
        typeId="quote"
        documentId="q-1"
        status={current}
        updatedAt={MANIFEST.acceptedAt}
      />
    </QueryClientProvider>
  )
  const utils = render(tree(status))
  return { ...utils, setStatus: (next: string) => utils.rerender(tree(next)) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("DocumentAcceptanceSection", () => {
  it("reads a quote with no manual acceptance as no record, in one request", async () => {
    const fetchMock = vi.fn(async () => emptyOk())
    vi.stubGlobal("fetch", fetchMock)
    const client = newClient()

    renderSection(client, "sent")

    await waitFor(() => expect(client.isFetching()).toBe(0))
    const state = client.getQueryState(["documents", "quote", "q-1", "manual-acceptance"])
    expect(state?.status).toBe("success")
    expect(state?.data).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("shows the acceptance when it lands while the page's own read of the record is still in flight", async () => {
    let archived = false
    let releaseHeld: (() => void) | undefined
    let requests = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        requests += 1
        // The answer is decided when the server reads the database, i.e. when the request starts.
        const answer = archived ? manifestOk() : emptyOk()
        if (!archived && requests === 3) {
          await new Promise<void>((resolve) => {
            releaseHeld = resolve
          })
        }
        return answer
      }),
    )
    const client = newClient()
    const { setStatus } = renderSection(client, "sent")

    const acceptNow = async () => {
      archived = true
      setStatus("accepted")
      await client.invalidateQueries({ queryKey: ["documents"] })
    }

    // Accept while a pre-acceptance read is in flight, if the page is still reading at all.
    await waitFor(() => expect(releaseHeld !== undefined || client.isFetching() === 0).toBe(true))
    if (releaseHeld) {
      const accepted = acceptNow()
      releaseHeld()
      await accepted
    } else {
      await acceptNow()
    }

    expect(
      await screen.findByTestId("document-acceptance-manual-entry", {}, { timeout: 2000 }),
    ).toHaveTextContent("John Doe")
  })
})
