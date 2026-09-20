import { useLoaderData } from "react-router"

import { UserTopicsView } from "@/components/user/user-center-views"
import { loadUserTopics } from "../route-helpers/user-profile"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

export async function loader({ request, params }: RouteArgs) {
  return loadUserTopics({ request, userId: params.userId || "" })
}

export async function clientLoader({ params }: RouteArgs) {
  return loadUserTopics({ userId: params.userId || "" })
}

export default function UserTopicsRoute() {
  const data = useLoaderData<typeof loader>()
  return <UserTopicsView initial={data} />
}
