import { useSearchParams } from "react-router"

import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

export default function DashboardTaskRewardsRoute() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const taskIdParam = searchParams.get("taskId")
  const defaultTaskId = taskIdParam ? Number(taskIdParam) : undefined

  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "taskRewards"),
    description: dashboardData.desc(t, "taskRewards"),
    listEndpoint: "/api/admin/task-reward/list",
    viewPermission: PERMISSIONS.DASHBOARD_REWARD_VIEW,
    defaultFilters: {
      status: 0,
      ...(defaultTaskId ? { taskId: defaultTaskId } : {}),
    },
    detailEndpoint: (id) => `/api/admin/task-reward/${id}`,
    createEndpoint: "/api/admin/task-reward/create",
    createPermission: PERMISSIONS.DASHBOARD_REWARD_CREATE,
    updateEndpoint: "/api/admin/task-reward/update",
    updatePermission: PERMISSIONS.DASHBOARD_REWARD_UPDATE,
    deleteEndpoint: "/api/admin/task-reward/delete",
    deletePermission: PERMISSIONS.DASHBOARD_REWARD_DELETE,
    deleteMode: "formIds",
    sortEndpoint: "/api/admin/task-reward/update_sort",
    sortPermission: PERMISSIONS.DASHBOARD_REWARD_UPDATE,
    dragSort: true,
    filters: [
      {
        name: "taskId",
        label: dashboardData.label(t, "taskId"),
        type: "number",
      },
      {
        name: "rewardCode",
        label: dashboardData.label(t, "rewardCode"),
        type: "select",
        optionsEndpoint: "/api/admin/reward-type-def/list",
        optionLabel: (record) =>
          String(record.nameZh || record.nameEn || record.code),
        optionValue: (record) => record.code as string,
      },
      {
        name: "status",
        label: dashboardData.label(t, "status"),
        type: "select",
        options: dashboardData.normalDeletedOptions(t),
      },
    ],
    columns: [
      { key: "id", label: dashboardData.label(t, "id") },
      { key: "taskId", label: dashboardData.label(t, "taskId") },
      { key: "rewardCode", label: dashboardData.label(t, "rewardCode") },
      { key: "amount", label: dashboardData.label(t, "amount") },
      { key: "badgeId", label: dashboardData.label(t, "badgeId") },
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
      {
        name: "taskId",
        label: dashboardData.label(t, "taskId"),
        type: "select",
        optionsEndpoint: "/api/admin/task-config/list",
        optionLabel: (record) =>
          `${String(record.title || record.name || record.id)} (#${record.id})`,
        optionValue: (record) => record.id as number,
        required: true,
      },
      {
        name: "rewardCode",
        label: dashboardData.label(t, "rewardCode"),
        type: "select",
        optionsEndpoint: "/api/admin/reward-type-def/list",
        optionLabel: (record) =>
          `${String(record.nameZh || record.nameEn || record.code)} (${record.code})`,
        optionValue: (record) => record.code as string,
        required: true,
      },
      {
        name: "amount",
        label: dashboardData.label(t, "amount"),
        type: "number",
        min: 0,
        step: 1,
      },
      {
        name: "badgeId",
        label: dashboardData.label(t, "badgeId"),
        type: "select",
        options: [{ label: t("dashboard.task.noBadge"), value: 0 }],
        optionsEndpoint: "/api/admin/badge/list",
        optionLabel: (record) =>
          String(record.title || record.name || record.id),
        optionValue: (record) => record.id as number,
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
