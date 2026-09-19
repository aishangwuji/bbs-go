"use client"

import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

export default function DashboardBadgesRoute() {
  const { t } = useI18n()
  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "badges"),
    description: dashboardData.desc(t, "badges"),
    listEndpoint: "/api/admin/badge/list",
    viewPermission: PERMISSIONS.DASHBOARD_BADGE_VIEW,
    defaultFilters: { status: 0 },
    detailEndpoint: (id) => `/api/admin/badge/${id}`,
    createEndpoint: "/api/admin/badge/create",
    createPermission: PERMISSIONS.DASHBOARD_BADGE_CREATE,
    updateEndpoint: "/api/admin/badge/update",
    updatePermission: PERMISSIONS.DASHBOARD_BADGE_UPDATE,
    deleteEndpoint: "/api/admin/badge/delete",
    deletePermission: PERMISSIONS.DASHBOARD_BADGE_DELETE,
    deleteMode: "formIds",
    sortEndpoint: "/api/admin/badge/update_sort",
    sortPermission: PERMISSIONS.DASHBOARD_BADGE_UPDATE,
    dragSort: true,
    filters: [
      { name: "name", label: dashboardData.label(t, "name") },
      { name: "title", label: dashboardData.label(t, "title") },
      {
        name: "status",
        label: dashboardData.label(t, "status"),
        type: "select",
        options: dashboardData.normalDeletedOptions(t),
      },
    ],
    columns: [
      { key: "id", label: dashboardData.label(t, "id") },
      { key: "name", label: dashboardData.label(t, "name") },
      { key: "title", label: dashboardData.label(t, "title") },
      {
        key: "description",
        label: dashboardData.label(t, "description"),
        className: "min-w-72",
      },
      {
        key: "icon",
        label: dashboardData.label(t, "icon"),
        render: (record) =>
          dashboardData.imageCell(record.icon, String(record.title || "")),
      },
      {
        key: "grantType",
        label: "获取方式",
        render: (record) => {
          const type = String(record.grantType || "manual")
          if (type === "auto") {
            return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400">自动解锁</span>
          }
          return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400">人工特赐</span>
        },
      },
      {
        key: "ruleCondition",
        label: "解锁条件",
        render: (record) => {
          if (record.grantType !== "auto" || !record.ruleField) {
            return <span className="text-muted-foreground">-</span>
          }
          const fieldMap: Record<string, string> = {
            topic_count: "发帖数 ≥",
            comment_count: "回帖数 ≥",
            consecutive_days: "连续签到天数 ≥",
            level: "等级 ≥",
            reg_days: "注册天数 ≥",
            exp: "经验值 ≥",
            score: "积分 ≥",
            fans_count: "粉丝数 ≥",
          }
          const label = fieldMap[String(record.ruleField)] || String(record.ruleField)
          return <span className="font-medium text-xs">{label} {String(record.ruleValue ?? 0)}</span>
        },
      },
      { key: "sortNo", label: dashboardData.label(t, "sortNo") },
      {
        key: "status",
        label: dashboardData.label(t, "status"),
        render: (record) => dashboardData.emailStatusCell(t, record.status),
      },
      {
        key: "updateTime",
        label: dashboardData.label(t, "updateTime"),
        render: (record) => dashboardData.dateCell(record.updateTime),
      },
    ],
    formFields: [
      {
        name: "name",
        label: dashboardData.label(t, "name"),
        required: true,
        colSpan: 2,
      },
      {
        name: "title",
        label: dashboardData.label(t, "title"),
        required: true,
        colSpan: 2,
      },
      {
        name: "grantType",
        label: "获取方式",
        type: "select",
        options: [
          { label: "人工特赐 (管理员手动颁发)", value: "manual" },
          { label: "自动达成 (满足规则指标自动解锁)", value: "auto" },
        ],
        required: true,
      },
      {
        name: "ruleField",
        label: "解锁指标 (仅自动勋章生效)",
        type: "select",
        options: [
          { label: "无 / 不限制", value: "" },
          { label: "发帖数量 (topic_count)", value: "topic_count" },
          { label: "回帖数量 (comment_count)", value: "comment_count" },
          { label: "连续签到天数 (consecutive_days)", value: "consecutive_days" },
          { label: "用户等级 (level)", value: "level" },
          { label: "注册天数 / 站龄 (reg_days)", value: "reg_days" },
          { label: "累计经验 (exp)", value: "exp" },
          { label: "当前积分 (score)", value: "score" },
          { label: "粉丝数量 (fans_count)", value: "fans_count" },
        ],
      },
      {
        name: "ruleValue",
        label: "达成门槛阈值 (仅自动勋章生效)",
        type: "number",
        min: 0,
      },
      {
        name: "description",
        label: dashboardData.label(t, "description"),
        type: "textarea",
      },
      { name: "icon", label: dashboardData.label(t, "icon"), type: "image" },
    ],
  }

  return <DashboardDataPage config={config} />
}
