import { useApiQuery } from "@/hooks/use-api-query"
import { queryKeys } from "@/lib/query-keys"

export interface RegistrationStatusView {
  /** Whether an account can be created without an invitation code. */
  allowed: boolean
  requiresCode: boolean
  message?: string
}

/** `GET /api/invitations/can-register`, public: the same decision the sign-up hook enforces. */
export function useRegistrationStatus() {
  return useApiQuery<RegistrationStatusView>(
    queryKeys.registration.status(),
    "/api/invitations/can-register",
    {
      staleTime: 5 * 60_000,
    },
  )
}
