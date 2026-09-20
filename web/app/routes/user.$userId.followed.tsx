import { useLoaderData } from "react-router"

import { UserFollowedView } from "@/components/user/user-center-views"
import { loadUserFollowed } from "../route-helpers/user-profile"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

export async function loader({ request, params }: RouteArgs) {
  return loadUserFollowed({ request, userId: params.userId || "" })
}

export async function clientLoader({ params }: RouteArgs) {
  return loadUserFollowed({ userId: params.userId || "" })
}

export default function UserFollowedRoute() {
  const data = useLoaderData<typeof loader>()
  return <UserFollowedView initial={data} />
}
