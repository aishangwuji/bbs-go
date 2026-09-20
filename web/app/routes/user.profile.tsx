import { redirect } from "react-router"

import { requireUser, requireUserClient } from "../route-helpers/auth"

// 资料页已内嵌为个人主页 Tab（/user/:id/profile）。旧地址保留做重定向，
// 兼容书签与站内既有入口（如邮件验证、评论区账号设置提示）。
export async function loader(args: { request: Request }) {
  const user = await requireUser(args)
  return redirect(`/user/${user.id}/profile`)
}

export async function clientLoader(args: { request: Request }) {
  const user = await requireUserClient(args)
  return redirect(`/user/${user.id}/profile`)
}

export default function ProfileRedirectRoute() {
  return null
}
