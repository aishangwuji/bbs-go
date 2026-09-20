import { redirect } from "react-router"

import { requireUser, requireUserClient } from "../route-helpers/auth"

// 账号设置已内嵌为个人主页 Tab（/user/:id/account）。旧地址保留做重定向，
// 兼容书签与站内既有入口（如邮件验证、评论区账号设置提示）。
export async function loader(args: { request: Request }) {
  const user = await requireUser(args)
  return redirect(`/user/${user.id}/account`)
}

export async function clientLoader(args: { request: Request }) {
  const user = await requireUserClient(args)
  return redirect(`/user/${user.id}/account`)
}

export default function AccountRedirectRoute() {
  return null
}
