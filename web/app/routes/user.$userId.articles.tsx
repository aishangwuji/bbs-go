import { useLoaderData } from "react-router"

import { UserArticlesView } from "@/components/user/user-center-views"
import { loadUserArticles } from "../route-helpers/user-profile"

type RouteArgs = {
  request: Request
  params: { userId?: string }
}

export async function loader({ request, params }: RouteArgs) {
  return loadUserArticles({ request, userId: params.userId || "" })
}

export async function clientLoader({ params }: RouteArgs) {
  return loadUserArticles({ userId: params.userId || "" })
}

export default function UserArticlesRoute() {
  const data = useLoaderData<typeof loader>()
  return <UserArticlesView initial={data} />
}
