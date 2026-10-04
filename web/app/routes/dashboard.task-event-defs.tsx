"use client"

import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

export default function DashboardTaskEventDefsRoute() {
  const { t } = useI18n()
  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "taskEventDefs"),
    description: dashboardData.desc(t, "taskEventDefs"),
    listEndpoint: "/api/admin/task-event-def/list",
    viewPermission: PERMISSIONS.DASHBOARD_TASK_EVENT_VIEW,
    defaultFilters: { status: 0 },
    detailEndpoint: (id) => `/api/admin/task-event-def/${id}`,
    createEndpoint: "/api/admin/task-event-def/create",
    createPermission: PERMISSIONS.DASHBOARD_TASK_EVENT_CREATE,
    updateEndpoint: "/api/admin/task-event-def/update",
    updatePermission: PERMISSIONS.DASHBOARD_TASK_EVENT_UPDATE,
    deleteEndpoint: "/api/admin/task-event-def/delete",
    deletePermission: PERMISSIONS.DASHBOARD_TASK_EVENT_DELETE,
    deleteMode: "formIds",
    sortEndpoint: "/api/admin/task-event-def/update_sort",
    sortPermission: PERMISSIONS.DASHBOARD_TASK_EVENT_UPDATE,
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
      { key: "producer", label: dashboardData.label(t, "producer") },
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
        name: "producer",
        label: dashboardData.label(t, "producer"),
        colSpan: 2,
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
