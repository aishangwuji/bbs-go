import { useOutletContext } from "react-router"

import { UserBadgesView } from "@/components/user/user-center-views"
import type { UserCenterData } from "../route-helpers/user-profile"

// 勋章数据已随布局外壳一次拉取，这里直接复用父级 Outlet context，不再单独请求。
export default function UserBadgesRoute() {
  const { badges } = useOutletContext<UserCenterData>()
  return <UserBadgesView badges={badges.filter((badge) => badge.owned)} />
}
