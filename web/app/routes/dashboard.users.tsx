"use client"

import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

export default function DashboardUsersRoute() {
  const { t } = useI18n()
  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "users"),
    description: dashboardData.desc(t, "users"),
    listEndpoint: "/api/admin/user/list",
    viewPermission: PERMISSIONS.DASHBOARD_USER_VIEW,
    detailEndpoint: (id) => `/api/admin/user/${id}`,
    updateEndpoint: "/api/admin/user/update",
    updatePermission: PERMISSIONS.DASHBOARD_USER_UPDATE,
    filters: [
      { name: "id", label: dashboardData.label(t, "id") },
      { name: "username", label: dashboardData.label(t, "username") },
      { name: "nickname", label: dashboardData.label(t, "nickname") },
      {
        name: "forbidden",
        label: dashboardData.label(t, "forbidden"),
        type: "select",
        options: [
          { label: t("dashboard.boolean.yes"), value: "true" },
          { label: t("dashboard.boolean.no"), value: "false" },
        ],
      },
    ],
    columns: [
      {
        key: "id",
        label: dashboardData.label(t, "id"),
        render: (record) => dashboardData.userLinkCell(record, record.id),
      },
      {
        key: "idEncode",
        label: dashboardData.label(t, "idEncode"),
        render: (record) => dashboardData.userLinkCell(record, record.idEncode),
      },
      {
        key: "avatar",
        label: dashboardData.label(t, "avatar"),
        render: (record) =>
          dashboardData.imageCell(
            record.avatar || record.smallAvatar,
            String(record.nickname || record.username || "")
          ),
      },
      {
        key: "username",
        label: dashboardData.label(t, "username"),
        render: (record) => dashboardData.userLinkCell(record, record.username),
      },
      {
        key: "nickname",
        label: dashboardData.label(t, "nickname"),
        render: (record) => dashboardData.userLinkCell(record, record.nickname),
      },
      { key: "email", label: dashboardData.label(t, "email") },
      { key: "score", label: dashboardData.label(t, "score") },
      { key: "level", label: dashboardData.label(t, "level") },
      {
        key: "violationCount",
        label: "违规次数",
        render: (record) => {
          const count = Number(record.violationCount || 0)
          if (count === 0) {
            return <span className="text-muted-foreground font-mono">0</span>
          }
          if (count >= 3) {
            return (
              <Badge variant="destructive" className="font-mono text-xs px-2">
                {count} 次高危
              </Badge>
            )
          }
          return (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 font-mono text-xs">
              {count} 次
            </Badge>
          )
        },
      },
      {
        key: "forbidden",
        label: dashboardData.label(t, "forbidden"),
        render: (record) =>
          record.forbidden
            ? t("dashboard.boolean.yes")
            : t("dashboard.boolean.no"),
      },
      {
        key: "createTime",
        label: dashboardData.label(t, "createTime"),
        render: (record) => dashboardData.dateCell(record.createTime),
      },
    ],
    formFields: [
      {
        name: "username",
        label: dashboardData.label(t, "username"),
      },
      { name: "email", label: dashboardData.label(t, "email") },
      {
        name: "nickname",
        label: dashboardData.label(t, "nickname"),
        required: true,
      },
      {
        name: "avatar",
        label: dashboardData.label(t, "avatar"),
        type: "image",
      },
      {
        name: "gender",
        label: dashboardData.label(t, "gender"),
        type: "select",
        options: [
          { label: t("dashboard.gender.male"), value: "Male" },
          { label: t("dashboard.gender.female"), value: "Female" },
        ],
      },
      { name: "homePage", label: dashboardData.label(t, "homePage") },
      {
        name: "description",
        label: dashboardData.label(t, "description"),
        type: "textarea",
      },
      {
        name: "signature",
        label: dashboardData.label(t, "signature"),
        type: "textarea",
      },
      {
        name: "roleIds",
        label: dashboardData.label(t, "roles"),
        type: "multiselect",
        optionsEndpoint: "/api/admin/role/roles",
        optionLabel: (record) =>
          String(record.name || record.code || record.id),
        optionValue: (record) => record.id as number,
        valueFromRecord: (record) =>
          Array.isArray(record.roleIds)
            ? record.roleIds.map((item) => String(item))
            : [],
      },
    ],
    rowActions: [
      {
        label: t("dashboard.actions.resetPassword"),
        endpoint: "/api/admin/user/reset_password",
        permission: PERMISSIONS.DASHBOARD_USER_RESET_PASSWORD,
        payload: (record) => ({ userId: record.id as number }),
        confirm: t("dashboard.confirmResetPassword"),
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
