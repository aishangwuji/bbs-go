"use client"

import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

export default function DashboardRewardTypeDefsRoute() {
  const { t } = useI18n()
  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "rewardTypes"),
    description: dashboardData.desc(t, "rewardTypes"),
    listEndpoint: "/api/admin/reward-type-def/list",
    viewPermission: PERMISSIONS.DASHBOARD_REWARD_VIEW,
    defaultFilters: { status: 0 },
    detailEndpoint: (id) => `/api/admin/reward-type-def/${id}`,
    createEndpoint: "/api/admin/reward-type-def/create",
    createPermission: PERMISSIONS.DASHBOARD_REWARD_CREATE,
    updateEndpoint: "/api/admin/reward-type-def/update",
    updatePermission: PERMISSIONS.DASHBOARD_REWARD_UPDATE,
    deleteEndpoint: "/api/admin/reward-type-def/delete",
    deletePermission: PERMISSIONS.DASHBOARD_REWARD_DELETE,
    deleteMode: "formIds",
    sortEndpoint: "/api/admin/reward-type-def/update_sort",
    sortPermission: PERMISSIONS.DASHBOARD_REWARD_UPDATE,
    dragSort: true,
    filters: [
      { name: "code", label: dashboardData.label(t, "code") },
      {
        name: "status",
        label: dashboardData.label(t, "status"),
        type: "select",
        options: dashboardData.normalDeletedOptions(t),
      },
    ],
    columns: [
      { key: "id", label: dashboardData.label(t, "id") },
      { key: "code", label: dashboardData.label(t, "code") },
      { key: "nameZh", label: dashboardData.label(t, "nameZh") },
      { key: "nameEn", label: dashboardData.label(t, "nameEn") },
      { key: "executor", label: dashboardData.label(t, "executor") },
      {
        key: "enabled",
        label: dashboardData.label(t, "enabled"),
        render: (record) =>
          Number(record.enabled) === 1
            ? t("dashboard.status.normal")
            : t("dashboard.status.disabled"),
      },
      { key: "sortNo", label: dashboardData.label(t, "sortNo") },
      {
        key: "status",
        label: dashboardData.label(t, "status"),
        render: (record) => dashboardData.disabledStatusCell(t, record.status),
      },
      {
        key: "updateTime",
        label: dashboardData.label(t, "updateTime"),
        render: (record) => dashboardData.dateCell(record.updateTime),
      },
    ],
    formFields: [
      { name: "code", label: dashboardData.label(t, "code"), required: true },
      { name: "nameZh", label: dashboardData.label(t, "nameZh"), required: true },
      { name: "nameEn", label: dashboardData.label(t, "nameEn"), required: true },
      {
        name: "executor",
        label: dashboardData.label(t, "executor"),
        required: true,
        type: "select",
        options: [
          { label: "score (积分发放器)", value: "score" },
          { label: "exp (经验发放器)", value: "exp" },
          { label: "badge (勋章发放器)", value: "badge" },
        ],
      },
      {
        name: "enabled",
        label: dashboardData.label(t, "enabled"),
        type: "select",
        options: [
          { label: t("dashboard.status.normal"), value: 1 },
          { label: t("dashboard.status.disabled"), value: 0 },
        ],
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
