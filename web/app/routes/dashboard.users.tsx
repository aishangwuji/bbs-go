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
        name: "roleId",
        label: dashboardData.label(t, "roles"),
        type: "select",
        // 角色下拉与下方编辑表单的 roleIds 共用同一数据源（/dashboard/roles 同源），
        // 选项由 use-dashboard-data-page 按 optionsEndpoint 自动拉取；清空即取消筛选。
        optionsEndpoint: "/api/admin/role/roles",
        optionLabel: (record) =>
          String(record.name || record.code || record.id),
        optionValue: (record) => record.id as number,
      },
      {
        name: "forbidden",
        label: dashboardData.label(t, "forbidden"),
        type: "select",
        options: [
          { label: t("dashboard.boolean.yes"), value: "true" },
          { label: t("dashboard.boolean.no"), value: "false" },
        ],
      },
      {
        name: "minViolationCount",
        label: dashboardData.label(t, "minViolationCount"),
        type: "number",
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
        label: dashboardData.label(t, "violationCount"),
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
    // 批量操作复用单条接口逐条执行：禁言（单条会同步 +1 违规次数）、解禁、重置密码（新密码汇总展示）。
    // 通用框架负责多选态/前置表单/确认/结果汇总，本页只需声明 endpoint 与参数映射。
    batchActions: [
      {
        label: t("dashboard.actions.batchForbidden"),
        endpoint: "/api/admin/user/forbidden",
        permission: PERMISSIONS.DASHBOARD_USER_FORBIDDEN,
        payload: (record, extra) => ({
          userId: record.id as number,
          days: extra.days,
          reason: extra.reason,
        }),
        extraFields: [
          {
            name: "days",
            label: t("dashboard.batch.days"),
            type: "number",
            required: true,
            min: 1,
          },
          {
            name: "reason",
            label: dashboardData.label(t, "reason"),
            type: "textarea",
          },
        ],
        extraInitialValues: { days: 7 },
        confirm: (count) =>
          t("dashboard.batch.confirmForbidden", { count }),
      },
      {
        label: t("dashboard.actions.batchUnforbidden"),
        endpoint: "/api/admin/user/forbidden",
        permission: PERMISSIONS.DASHBOARD_USER_FORBIDDEN,
        payload: (record) => ({ userId: record.id as number, days: 0 }),
        confirm: (count) =>
          t("dashboard.batch.confirmUnforbidden", { count }),
      },
      {
        label: t("dashboard.actions.batchResetPassword"),
        endpoint: "/api/admin/user/reset_password",
        permission: PERMISSIONS.DASHBOARD_USER_RESET_PASSWORD,
        payload: (record) => ({ userId: record.id as number }),
        confirm: (count) =>
          t("dashboard.batch.confirmResetPasswords", { count }),
        describeResult: (_record, result) =>
          result &&
          typeof result === "object" &&
          "password" in result &&
          typeof result.password === "string"
            ? result.password
            : undefined,
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
