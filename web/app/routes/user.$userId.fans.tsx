import { useLoaderData } from "react-router"

import { UserFansView } from "@/components/user/user-center-views"
import { loadUserFans } from "../route-helpers/user-profile"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

export async function loader({ request, params }: RouteArgs) {
  return loadUserFans({ request, userId: params.userId || "" })
}

export async function clientLoader({ params }: RouteArgs) {
  return loadUserFans({ userId: params.userId || "" })
}

export default function UserFansRoute() {
  const data = useLoaderData<typeof loader>()
  return <UserFansView initial={data} />
}
