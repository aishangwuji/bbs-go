import { apiFetch } from "@/lib/api/client"
import type { UserSummary } from "@/lib/api/types"

export type UserProfileRouteData = {
  user: UserSummary
}

export async function loadUserProfileRouteData({
  request,
  userId,
}: {
  request?: Request
  userId: string
}): Promise<UserProfileRouteData> {
  const url = request ? new URL(request.url) : null
  const previewRole =
    url?.searchParams.get("preview_role") ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("preview_role")
      : null)

  const user = await apiFetch<UserSummary>(`/api/user/${userId}`, {
    ...(request ? { request } : {}),
    params: previewRole ? { preview_role: previewRole } : undefined,
  })

  return { user }
}
