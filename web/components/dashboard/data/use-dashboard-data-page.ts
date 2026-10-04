"use client"

import * as React from "react"

import type { ConfirmDialogState } from "@/components/dashboard/confirm-dialog"
import {
  adminDelete,
  adminGet,
  adminList,
  adminPostForm,
  adminPostJson,
  type AdminFormValue,
  type AdminRecord,
} from "@/lib/api/admin"
import { createAdminInitialFilters } from "@/lib/dashboard/default-filters"
import { msgSuccess } from "@/lib/toast"

import type {
  DashboardDataBatchAction,
  DashboardDataBatchItemResult,
  DashboardDataBatchResult,
  DashboardDataOption,
  DashboardDataPageConfig,
  DashboardDataRowAction,
} from "./dashboard-data-types"
import {
  DASHBOARD_DATA_DEPTH_KEY,
  DASHBOARD_DATA_HAS_CHILDREN_KEY,
  DASHBOARD_DATA_KEY,
  DASHBOARD_DATA_PARENT_KEY,
  dashboardDataRecordToFormValues,
  dashboardDataRowKey,
  filterVisibleDashboardDataTree,
  flattenDashboardDataTree,
  isValidDashboardDataHttpUrl,
  normalizeDashboardDataOptionRecords,
  toDashboardDataPrimitive,
} from "./dashboard-data-utils"

export function useDashboardDataPage({
  config,
  messages,
}: {
  config: DashboardDataPageConfig
  messages: {
    loadFailed: string
    saveFailed: string
    deleteFailed: string
    actionFailed: string
    sameLevelSortOnly: string
    required: string
    invalidUrl: string
    invalidNumber: string
    minValue: (min: number) => string
    maxValue: (max: number) => string
    saved: string
    deleted: string
    actionDone: string
    confirmDelete: string
    deleteAction: string
  }
}) {
  const initialLimit = config.pageSize ?? 20
  const [filters, setFilters] = React.useState<Record<string, AdminFormValue>>(
    () => createAdminInitialFilters(config.defaultFilters, initialLimit)
  )
  const [records, setRecords] = React.useState<AdminRecord[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<AdminRecord | null>(null)
  const [viewing, setViewing] = React.useState<AdminRecord | null>(null)
  const [formValues, setFormValues] = React.useState<
    Record<string, AdminFormValue>
  >({})
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [confirmState, setConfirmState] =
    React.useState<ConfirmDialogState>(null)
  const [passwordResult, setPasswordResult] = React.useState<string | null>(
    null
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [asyncOptions, setAsyncOptions] = React.useState<
    Record<string, DashboardDataOption[]>
  >({})
  const [collapsedTreeKeys, setCollapsedTreeKeys] = React.useState<Set<string>>(
    () => new Set()
  )
  // 多选态：值为 dashboardDataRowKey(record, index)；翻页/筛选/执行后 reload 会清空
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(
    () => new Set()
  )
  // 批量操作进行到“收集中间表单”阶段的 action（extraFields 非空时）；提交后进确认/直接执行
  const [pendingBatch, setPendingBatch] =
    React.useState<DashboardDataBatchAction | null>(null)
  const [batchValues, setBatchValues] = React.useState<
    Record<string, AdminFormValue>
  >({})
  const [batchErrors, setBatchErrors] = React.useState<Record<string, string>>(
    {}
  )
  const [batchRunning, setBatchRunning] = React.useState(false)
  const [batchResult, setBatchResult] =
    React.useState<DashboardDataBatchResult | null>(null)
  const treeCollapseModeRef = React.useRef<string | null>(null)
  const knownTreeKeysRef = React.useRef<Set<string>>(new Set())

  const page = Number(filters.page || 1)
  const limit = Number(filters.limit || initialLimit)
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const treeRecords = React.useMemo(
    () => (config.tree ? flattenDashboardDataTree(records) : records),
    [config.tree, records]
  )
  const displayRecords = React.useMemo(
    () =>
      config.tree
        ? filterVisibleDashboardDataTree(treeRecords, collapsedTreeKeys)
        : records,
    [collapsedTreeKeys, config.tree, records, treeRecords]
  )
  const selectedRecords = React.useMemo(
    () =>
      displayRecords.filter((record, index) =>
        selectedKeys.has(dashboardDataRowKey(record, index))
      ),
    [displayRecords, selectedKeys]
  )
  const selectAllState: "all" | "some" | "none" =
    displayRecords.length === 0 || selectedRecords.length === 0
      ? "none"
      : selectedRecords.length >= displayRecords.length
        ? "all"
        : "some"

  React.useEffect(() => {
    if (!config.tree) {
      setCollapsedTreeKeys(new Set())
      treeCollapseModeRef.current = null
      knownTreeKeysRef.current = new Set()
      return
    }

    const nextKeys = new Set(
      treeRecords.map((record) => String(record[DASHBOARD_DATA_KEY]))
    )
    const nextParentKeys = new Set(
      treeRecords
        .filter((record) => record[DASHBOARD_DATA_HAS_CHILDREN_KEY])
        .map((record) => String(record[DASHBOARD_DATA_KEY]))
    )
    const collapseMode = config.treeDefaultCollapsed ? "collapsed" : "expanded"

    if (treeCollapseModeRef.current !== collapseMode) {
      setCollapsedTreeKeys(
        config.treeDefaultCollapsed ? nextParentKeys : new Set()
      )
      treeCollapseModeRef.current = collapseMode
      knownTreeKeysRef.current = nextKeys
      return
    }

    setCollapsedTreeKeys((current) => {
      const nextCollapsedKeys = new Set(
        Array.from(current).filter((key) => nextKeys.has(key))
      )
      if (config.treeDefaultCollapsed) {
        nextParentKeys.forEach((key) => {
          if (!knownTreeKeysRef.current.has(key)) {
            nextCollapsedKeys.add(key)
          }
        })
      }
      return nextCollapsedKeys
    })
    knownTreeKeysRef.current = nextKeys
  }, [config.tree, config.treeDefaultCollapsed, treeRecords])

  const visibleFormFields = React.useMemo(
    () =>
      (config.formFields || []).filter(
        (field) =>
          !(
            field.name === "id" &&
            (formValues.id === undefined ||
              formValues.id === null ||
              formValues.id === "")
          )
      ),
    [config.formFields, formValues.id]
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (config.listResult === "array") {
        const data = await adminPostForm<AdminRecord[]>(
          config.listEndpoint,
          filters
        )
        setRecords(Array.isArray(data) ? data : [])
        setTotal(Array.isArray(data) ? data.length : 0)
        setSelectedKeys(new Set())
        return
      }

      const data = await adminList(config.listEndpoint, filters)
      setRecords(data.results || [])
      setTotal(data.page?.total ?? data.results?.length ?? 0)
      setSelectedKeys(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [
    config.listEndpoint,
    config.listResult,
    config.refreshKey,
    filters,
    messages.loadFailed,
  ])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const sources = [...(config.filters || []), ...(config.formFields || [])]
      .filter((source) => source.optionsEndpoint)
      .map((source) => ({
        key: source.name,
        endpoint: source.optionsEndpoint as string,
        optionLabel:
          source.optionLabel ??
          ((record: AdminRecord) =>
            String(record.name ?? record.title ?? record.label ?? record.id)),
        optionValue:
          source.optionValue ??
          ((record: AdminRecord) =>
            (record.id ?? record.value) as string | number),
      }))

    if (!sources.length) return

    let cancelled = false
    void Promise.all(
      sources.map(async (source) => {
        const data = await adminGet<unknown>(source.endpoint)
        const optionRecords = normalizeDashboardDataOptionRecords(data)
        return {
          key: source.key,
          options: optionRecords.map((record) => ({
            label: source.optionLabel(record),
            value: source.optionValue(record),
          })),
        }
      })
    )
      .then((results) => {
        if (cancelled) return
        setAsyncOptions((current) => ({
          ...current,
          ...Object.fromEntries(
            results.map((result) => [result.key, result.options])
          ),
        }))
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : messages.loadFailed)
        }
      })

    return () => {
      cancelled = true
    }
  }, [config.filters, config.formFields, messages.loadFailed])

  function updateFilter(name: string, value: AdminFormValue) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : name === "limit" ? current.page : 1,
    }))
  }

  async function openEdit(record: AdminRecord) {
    const id = record.id as AdminFormValue
    if (config.detailEndpoint && id !== undefined) {
      const detail = await adminGet<AdminRecord>(config.detailEndpoint(id))
      const nextValues = dashboardDataRecordToFormValues(detail)
      config.formFields?.forEach((field) => {
        if (field.valueFromRecord) {
          nextValues[field.name] = field.valueFromRecord(detail)
        }
      })
      setFormValues(nextValues)
      setFormErrors({})
      setEditing(detail)
      return
    }
    setFormValues(dashboardDataRecordToFormValues(record))
    setFormErrors({})
    setEditing(record)
  }

  async function openView(record: AdminRecord) {
    const id = record.id as AdminFormValue
    if (config.detailEndpoint && id !== undefined) {
      const detail = await adminGet<AdminRecord>(config.detailEndpoint(id))
      setViewing(detail)
      return
    }
    setViewing(record)
  }

  function openCreate() {
    setFormValues({})
    setFormErrors({})
    setEditing({})
  }

  // 表单校验抽为纯函数：主编辑表单与批量前置表单共用同一套 required/number/url 规则
  function validateFieldValues(
    fields: NonNullable<DashboardDataPageConfig["formFields"]>,
    values: Record<string, AdminFormValue>
  ) {
    const errors: Record<string, string> = {}
    for (const field of fields) {
      const value = values[field.name]
      const text = value === undefined || value === null ? "" : String(value)
      if (field.required && text.trim() === "") {
        errors[field.name] = messages.required
        continue
      }
      if (
        field.type === "url" &&
        text.trim() !== "" &&
        !isValidDashboardDataHttpUrl(text)
      ) {
        errors[field.name] = messages.invalidUrl
        continue
      }
      if (field.type === "number" && text.trim() !== "") {
        const numberValue = Number(text)
        if (!Number.isFinite(numberValue)) {
          errors[field.name] = messages.invalidNumber
          continue
        }
        if (field.min !== undefined && numberValue < field.min) {
          errors[field.name] = messages.minValue(field.min)
          continue
        }
        if (field.max !== undefined && numberValue > field.max) {
          errors[field.name] = messages.maxValue(field.max)
        }
      }
    }
    return errors
  }

  function validateForm() {
    const errors = validateFieldValues(visibleFormFields, formValues)
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function toggleSelectRecord(record: AdminRecord, index: number) {
    const key = dashboardDataRowKey(record, index)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleSelectPage() {
    const pageKeys = displayRecords.map((record, index) =>
      dashboardDataRowKey(record, index)
    )
    setSelectedKeys((current) => {
      const allSelected = pageKeys.every((key) => current.has(key))
      const next = new Set(current)
      if (allSelected) {
        pageKeys.forEach((key) => next.delete(key))
      } else {
        pageKeys.forEach((key) => next.add(key))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedKeys(new Set())
  }

  // 批量入口：有前置表单先弹窗收集，否则直接进确认/执行
  function startBatchAction(action: DashboardDataBatchAction) {
    if (selectedRecords.length === 0) return
    if (action.extraFields?.length) {
      setBatchValues(action.extraInitialValues ?? {})
      setBatchErrors({})
      setPendingBatch(action)
      return
    }
    requestBatchConfirm(action, {})
  }

  function submitBatchForm(event: React.FormEvent) {
    event.preventDefault()
    if (!pendingBatch) return
    const errors = validateFieldValues(
      pendingBatch.extraFields ?? [],
      batchValues
    )
    setBatchErrors(errors)
    if (Object.keys(errors).length > 0) return
    const action = pendingBatch
    setPendingBatch(null)
    requestBatchConfirm(action, batchValues)
  }

  function requestBatchConfirm(
    action: DashboardDataBatchAction,
    extra: Record<string, AdminFormValue>
  ) {
    const count = selectedRecords.length
    if (count === 0) return
    const confirmText =
      typeof action.confirm === "function"
        ? action.confirm(count)
        : action.confirm
    if (confirmText) {
      setConfirmState({
        description: confirmText,
        confirmText: action.label,
        onConfirm: () => {
          void runBatchAction(action, extra)
        },
      })
      return
    }
    void runBatchAction(action, extra)
  }

  // 逐条顺序执行：复用单条接口，单条失败不阻断后续，结果汇总后统一 reload
  async function runBatchAction(
    action: DashboardDataBatchAction,
    extra: Record<string, AdminFormValue>
  ) {
    const targets = selectedRecords
    if (targets.length === 0) return
    setBatchRunning(true)
    setError(null)
    const items: DashboardDataBatchItemResult[] = []
    try {
      for (const record of targets) {
        try {
          const payload = action.payload?.(record, extra) ?? {
            id: record.id as AdminFormValue,
          }
          const result =
            action.method === "DELETE"
              ? await adminDelete(action.endpoint, payload)
              : await adminPostForm(action.endpoint, payload)
          items.push({
            record,
            ok: true,
            message: action.describeResult?.(record, result),
          })
        } catch (err) {
          items.push({
            record,
            ok: false,
            message: err instanceof Error ? err.message : messages.actionFailed,
          })
        }
      }
      setBatchResult({ title: action.label, items })
      await load()
    } finally {
      setBatchRunning(false)
    }
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (!validateForm()) return

    const isEdit =
      formValues.id !== undefined &&
      formValues.id !== null &&
      formValues.id !== ""
    const endpoint = isEdit ? config.updateEndpoint : config.createEndpoint
    if (!endpoint) return

    setSubmitting(true)
    setError(null)
    try {
      await adminPostForm(
        endpoint,
        config.transformSubmitValues?.(formValues) ?? formValues
      )
      msgSuccess(messages.saved)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function requestDelete(record: AdminRecord) {
    if (!config.deleteEndpoint) return
    setConfirmState({
      description: messages.confirmDelete,
      confirmText: messages.deleteAction,
      onConfirm: () => {
        void performDeleteRecord(record)
      },
    })
  }

  async function performDeleteRecord(record: AdminRecord) {
    if (!config.deleteEndpoint) return
    const id = toDashboardDataPrimitive(record.id)
    setError(null)
    try {
      if (config.deleteMode === "jsonIds") {
        await adminPostJson(config.deleteEndpoint, { ids: [id] })
      } else if (config.deleteMode === "formIds") {
        await adminPostForm(config.deleteEndpoint, { ids: [id] })
      } else {
        await adminPostForm(config.deleteEndpoint, { id })
      }
      msgSuccess(messages.deleted)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.deleteFailed)
    }
  }

  async function runAction(
    action: DashboardDataRowAction,
    record: AdminRecord
  ) {
    if (action.confirm) {
      setConfirmState({
        description: action.confirm,
        confirmText: action.label,
        onConfirm: () => {
          void performAction(action, record)
        },
      })
      return
    }

    await performAction(action, record)
  }

  async function performAction(
    action: DashboardDataRowAction,
    record: AdminRecord
  ) {
    setError(null)
    try {
      const payload = action.payload?.(record) ?? {
        id: record.id as AdminFormValue,
      }
      const result =
        action.method === "DELETE"
          ? await adminDelete(action.endpoint, payload)
          : await adminPostForm(action.endpoint, payload)
      if (
        result &&
        typeof result === "object" &&
        "password" in result &&
        typeof result.password === "string"
      ) {
        setPasswordResult(result.password)
      } else {
        msgSuccess(action.successMessage || messages.actionDone)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.actionFailed)
    }
  }

  async function moveRecord(index: number, direction: -1 | 1) {
    if (!config.sortEndpoint) return

    if (!canMoveRecord(index, direction)) {
      setError(messages.sameLevelSortOnly)
      return
    }

    const nextRecords = config.tree
      ? moveTreeRecord(index, direction)
      : moveFlatRecord(index, direction)
    const ids = nextRecords
      .map((record) => toDashboardDataPrimitive(record.id))
      .filter((id) => id !== undefined && id !== null)

    setError(null)
    try {
      await adminPostJson(config.sortEndpoint, ids)
      msgSuccess(messages.saved)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.saveFailed)
    }
  }

  async function reorderRecord(fromIndex: number, toIndex: number) {
    if (!config.sortEndpoint || config.tree) return
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= displayRecords.length ||
      toIndex >= displayRecords.length
    ) {
      return
    }

    const nextRecords = [...displayRecords]
    const [current] = nextRecords.splice(fromIndex, 1)
    nextRecords.splice(toIndex, 0, current)
    const ids = nextRecords
      .map((record) => toDashboardDataPrimitive(record.id))
      .filter((id) => id !== undefined && id !== null)

    setError(null)
    try {
      await adminPostJson(config.sortEndpoint, ids)
      msgSuccess(messages.saved)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.saveFailed)
    }
  }

  function canMoveRecord(index: number, direction: -1 | 1) {
    if (!config.tree) {
      const targetIndex = index + direction
      return targetIndex >= 0 && targetIndex < displayRecords.length
    }

    const treeIndex = findTreeRecordIndex(index)
    return (
      treeIndex !== null &&
      findTreeMoveTargetIndex(treeIndex, direction) !== null
    )
  }

  function moveFlatRecord(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    const nextRecords = [...displayRecords]
    const [current] = nextRecords.splice(index, 1)
    nextRecords.splice(targetIndex, 0, current)
    return nextRecords
  }

  function moveTreeRecord(index: number, direction: -1 | 1) {
    const treeIndex = findTreeRecordIndex(index)
    if (treeIndex === null) return treeRecords

    const targetIndex = findTreeMoveTargetIndex(treeIndex, direction)
    if (targetIndex === null) return treeRecords

    const currentEnd = findTreeBlockEnd(treeIndex)
    const targetEnd = findTreeBlockEnd(targetIndex)
    const currentBlock = treeRecords.slice(treeIndex, currentEnd)
    const targetBlock = treeRecords.slice(targetIndex, targetEnd)

    if (direction === -1) {
      return [
        ...treeRecords.slice(0, targetIndex),
        ...currentBlock,
        ...targetBlock,
        ...treeRecords.slice(currentEnd),
      ]
    }

    return [
      ...treeRecords.slice(0, treeIndex),
      ...targetBlock,
      ...currentBlock,
      ...treeRecords.slice(targetEnd),
    ]
  }

  function findTreeMoveTargetIndex(index: number, direction: -1 | 1) {
    const record = treeRecords[index]
    if (!record) return null

    const depth = Number(record[DASHBOARD_DATA_DEPTH_KEY] ?? 0)
    if (direction === -1) {
      for (let targetIndex = index - 1; targetIndex >= 0; targetIndex -= 1) {
        const target = treeRecords[targetIndex]
        const targetDepth = Number(target?.[DASHBOARD_DATA_DEPTH_KEY] ?? 0)
        if (targetDepth > depth) continue
        if (targetDepth < depth) return null
        return target?.[DASHBOARD_DATA_PARENT_KEY] ===
          record[DASHBOARD_DATA_PARENT_KEY]
          ? targetIndex
          : null
      }
      return null
    }

    const targetIndex = findTreeBlockEnd(index)
    const target = treeRecords[targetIndex]
    return target?.[DASHBOARD_DATA_DEPTH_KEY] ===
      record[DASHBOARD_DATA_DEPTH_KEY] &&
      target?.[DASHBOARD_DATA_PARENT_KEY] === record[DASHBOARD_DATA_PARENT_KEY]
      ? targetIndex
      : null
  }

  function findTreeBlockEnd(index: number) {
    const depth = Number(treeRecords[index]?.[DASHBOARD_DATA_DEPTH_KEY] ?? 0)
    let end = index + 1
    while (
      end < treeRecords.length &&
      Number(treeRecords[end]?.[DASHBOARD_DATA_DEPTH_KEY] ?? 0) > depth
    ) {
      end += 1
    }
    return end
  }

  function findTreeRecordIndex(displayIndex: number) {
    const recordKey = displayRecords[displayIndex]?.[DASHBOARD_DATA_KEY]
    if (recordKey === undefined || recordKey === null) return null
    const treeIndex = treeRecords.findIndex(
      (record) => record[DASHBOARD_DATA_KEY] === recordKey
    )
    return treeIndex >= 0 ? treeIndex : null
  }

  function isTreeRecordCollapsed(record: AdminRecord) {
    const recordKey = record[DASHBOARD_DATA_KEY]
    return (
      recordKey !== undefined &&
      recordKey !== null &&
      collapsedTreeKeys.has(String(recordKey))
    )
  }

  function toggleTreeRecord(record: AdminRecord) {
    if (!record[DASHBOARD_DATA_HAS_CHILDREN_KEY]) return
    const recordKey = record[DASHBOARD_DATA_KEY]
    if (recordKey === undefined || recordKey === null) return

    setCollapsedTreeKeys((current) => {
      const next = new Set(current)
      const key = String(recordKey)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return {
    filters,
    displayRecords,
    total,
    loading,
    error,
    editing,
    viewing,
    formValues,
    formErrors,
    confirmState,
    passwordResult,
    submitting,
    asyncOptions,
    page,
    limit,
    pageCount,
    visibleFormFields,
    selectedKeys,
    selectedRecords,
    selectAllState,
    pendingBatch,
    batchValues,
    batchErrors,
    batchRunning,
    batchResult,
    load,
    updateFilter,
    setFilters,
    setEditing,
    setViewing,
    setFormValues,
    setConfirmState,
    setPasswordResult,
    openEdit,
    openView,
    openCreate,
    submitForm,
    requestDelete,
    runAction,
    toggleSelectRecord,
    toggleSelectPage,
    clearSelection,
    startBatchAction,
    submitBatchForm,
    setPendingBatch,
    setBatchValues,
    setBatchResult,
    moveRecord,
    reorderRecord,
    canMoveRecord,
    isTreeRecordCollapsed,
    toggleTreeRecord,
  }
}
