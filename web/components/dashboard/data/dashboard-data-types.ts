"use client"

import type * as React from "react"

import type { AdminFormValue, AdminRecord } from "@/lib/api/admin"
import type { PermissionCode } from "@/lib/auth/permissions.generated"

export type DashboardDataOption = {
  label: string
  value: string | number
}

export type DashboardDataOptionSource = {
  optionsEndpoint?: string
  optionLabel?: (record: AdminRecord) => string
  optionValue?: (record: AdminRecord) => string | number
}

export type DashboardDataFilter = DashboardDataOptionSource & {
  name: string
  label: string
  type?: "text" | "number" | "select"
  options?: DashboardDataOption[]
}

export type DashboardDataFormField = DashboardDataOptionSource & {
  name: string
  label: string
  required?: boolean
  colSpan?: 1 | 2
  type?:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "tree-select"
    | "multiselect"
    | "password"
    | "url"
    | "image"
    | "icon"
  options?: DashboardDataOption[]
  min?: number
  max?: number
  step?: number
  valueFromRecord?: (record: AdminRecord) => AdminFormValue
}

export type DashboardDataColumn = {
  key: string
  label: string
  className?: string
  render?: (record: AdminRecord) => React.ReactNode
}

export type DashboardDataRowAction = {
  label: string
  endpoint: string
  permission?: PermissionCode
  method?: "POST" | "DELETE"
  payload?: (record: AdminRecord) => Record<string, AdminFormValue>
  visible?: (record: AdminRecord) => boolean
  confirm?: string
  successMessage?: string
}

// 批量操作：对表格多选命中的记录逐个调用同一 endpoint（复用单条接口，无需后端新增批量接口）。
// 需要统一前置输入（如禁言天数/原因）时配 extraFields，执行前弹表单收集一次，
// 再与每条记录的 payload 合并后逐条发送；逐条失败互不影响，结果统一汇总展示。
export type DashboardDataBatchAction = {
  label: string
  endpoint: string
  permission?: PermissionCode
  method?: "POST" | "DELETE"
  payload?: (
    record: AdminRecord,
    extra: Record<string, AdminFormValue>
  ) => Record<string, AdminFormValue>
  extraFields?: DashboardDataFormField[]
  extraInitialValues?: Record<string, AdminFormValue>
  confirm?: string | ((count: number) => string)
  // 从单条响应中提取面向管理员的结果明细（如重置后的新密码），返回 undefined 则只展示成功/失败态
  describeResult?: (record: AdminRecord, result: unknown) => string | undefined
}

export type DashboardDataBatchItemResult = {
  record: AdminRecord
  ok: boolean
  // 成功时为 describeResult 的返回值，失败时为错误信息
  message?: string
}

export type DashboardDataBatchResult = {
  title: string
  items: DashboardDataBatchItemResult[]
}

export type DashboardDataDetailField = {
  key: string
  label: string
  render?: (record: AdminRecord) => React.ReactNode
}

export type DashboardDataPageConfig = {
  title: string
  description?: string
  listEndpoint: string
  viewPermission?: PermissionCode
  detailEndpoint?: (id: AdminFormValue) => string
  createEndpoint?: string
  createPermission?: PermissionCode
  updateEndpoint?: string
  updatePermission?: PermissionCode
  deleteEndpoint?: string
  deletePermission?: PermissionCode
  deleteMode?: "formId" | "formIds" | "jsonIds"
  sortEndpoint?: string
  sortPermission?: PermissionCode
  dragSort?: boolean
  tree?: boolean
  treeDefaultCollapsed?: boolean
  treeIndentKey?: string
  canEdit?: (record: AdminRecord) => boolean
  canDelete?: (record: AdminRecord) => boolean
  renderRowActions?: (record: AdminRecord) => React.ReactNode
  filters?: DashboardDataFilter[]
  defaultFilters?: Record<string, AdminFormValue>
  columns: DashboardDataColumn[]
  detailFields?: DashboardDataDetailField[]
  formFields?: DashboardDataFormField[]
  rowActions?: DashboardDataRowAction[]
  // 配置即启用表格多选（首列复选框 + 批量操作栏）；不配置则表格行为与之前完全一致
  batchActions?: DashboardDataBatchAction[]
  pageSize?: number
  listResult?: "page" | "array"
  refreshKey?: string | number
  formContainer?: "dialog" | "drawer"
  transformSubmitValues?: (
    values: Record<string, AdminFormValue>
  ) => Record<string, AdminFormValue>
}
