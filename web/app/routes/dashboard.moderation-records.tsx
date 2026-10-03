"use client"

import * as React from "react"
import {
  DashboardDataPage,
  type DashboardDataPageConfig,
} from "@/components/dashboard/data"
import * as dashboardData from "@/components/dashboard/data/dashboard-data-route-utils"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n/provider"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"

type ModerationDimensionResult = {
  type?: string
  key?: string
  label?: string
  value?: string
  description?: string
  confidence?: number
  verdict?: string
  reason?: string
}

function parseJsonArray<T>(value: unknown): T[] {
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function moderationVerdictBadge(verdict: string) {
  if (verdict === "reject") {
    return <Badge variant="destructive">下架</Badge>
  }
  if (verdict === "review") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-600 dark:text-amber-400"
      >
        待审
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-400 text-emerald-600 dark:text-emerald-400"
    >
      放行
    </Badge>
  )
}

export default function DashboardModerationRecordsRoute() {
  const { t } = useI18n()

  const config: DashboardDataPageConfig = {
    title: dashboardData.title(t, "moderationRecords"),
    description: dashboardData.desc(t, "moderationRecords"),
    listEndpoint: "/api/admin/moderation-record/list",
    viewPermission: PERMISSIONS.DASHBOARD_MODERATION_RECORD_VIEW,
    detailEndpoint: (id) => `/api/admin/moderation-record/${id}`,
    filters: [
      {
        name: "entityType",
        label: dashboardData.label(t, "entityType"),
        type: "select",
        options: [
          { label: "全部类型", value: "" },
          { label: "话题 (topic)", value: "topic" },
          { label: "文章 (article)", value: "article" },
          { label: "评论 (comment)", value: "comment" },
        ],
      },
      {
        name: "finalAction",
        label: dashboardData.label(t, "finalAction"),
        type: "select",
        options: [
          { label: "全部状态", value: "" },
          { label: "放行 (pass)", value: "pass" },
          { label: "待审 (review)", value: "review" },
          { label: "拦截 (reject)", value: "reject" },
        ],
      },
      {
        name: "suggestedAction",
        label: dashboardData.label(t, "suggestedAction"),
        type: "select",
        options: [
          { label: "全部模型建议", value: "" },
          { label: "建议放行 (pass)", value: "pass" },
          { label: "建议待审 (review)", value: "review" },
          { label: "建议拦截 (reject)", value: "reject" },
        ],
      },
      { name: "userId", label: dashboardData.label(t, "userId") },
      { name: "entityId", label: dashboardData.label(t, "entityId") },
    ],
    columns: [
      { key: "id", label: dashboardData.label(t, "id"), className: "w-16" },
      {
        key: "entityType",
        label: dashboardData.label(t, "entityType"),
        className: "w-24",
        render: (record) => {
          const type = String(record.entityType || "")
          if (type === "topic") return <Badge variant="secondary">话题</Badge>
          if (type === "article") {
            return (
              <Badge variant="secondary" className="border-blue-300 text-blue-700 dark:text-blue-300">
                文章
              </Badge>
            )
          }
          return <Badge variant="outline">评论</Badge>
        },
      },
      {
        key: "entityId",
        label: dashboardData.label(t, "entityId"),
        className: "w-24",
        render: (record) => {
          const id = String(record.entityId || "")
          const type = String(record.entityType || "")
          if (type === "topic" && id) {
            return (
              <a
                href={`/topic/${id}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-primary hover:underline"
              >
                #{id}
              </a>
            )
          }
          if (type === "article" && id) {
            return (
              <a
                href={`/article/${id}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-primary hover:underline"
              >
                #{id}
              </a>
            )
          }
          return <span className="font-mono text-xs text-muted-foreground">#{id}</span>
        },
      },
      {
        key: "userId",
        label: dashboardData.label(t, "userId"),
        className: "w-24",
        render: (record) => {
          const userId = record.userId
          if (!userId) return "-"
          return (
            <a
              href={`/user/${String(userId)}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-primary hover:underline"
            >
              UID: {String(userId)}
            </a>
          )
        },
      },
      {
        key: "contentSnapshot",
        label: dashboardData.label(t, "contentSnapshot"),
        className: "max-w-xs",
        render: (record) => {
          const text = String(record.contentSnapshot || "")
          return (
            <span
              className="block truncate text-xs text-muted-foreground"
              title={text}
            >
              {text || "-"}
            </span>
          )
        },
      },
      {
        key: "hitReasons",
        label: dashboardData.label(t, "hitReasons"),
        className: "max-w-sm",
        render: (record) => {
          const reasons = parseJsonArray<string>(record.hitReasons)
          if (reasons.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <span className="block truncate text-xs" title={reasons.join("\n")}>
              {reasons[0]}
              {reasons.length > 1 ? ` (+${reasons.length - 1})` : ""}
            </span>
          )
        },
      },
      {
        key: "finalAction",
        label: dashboardData.label(t, "finalAction"),
        className: "w-28",
        render: (record) => {
          const action = String(record.finalAction || "")
          if (action === "reject") {
            return <Badge variant="destructive">拦截下架</Badge>
          }
          if (action === "review") {
            return (
              <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                转待审核
              </Badge>
            )
          }
          return (
            <Badge variant="outline" className="border-emerald-400 text-emerald-600 dark:text-emerald-400">
              放行通过
            </Badge>
          )
        },
      },
      {
        key: "createTime",
        label: dashboardData.label(t, "createTime"),
        className: "w-40",
        render: (record) => dashboardData.dateCell(record.createTime),
      },
    ],
    detailFields: [
      { key: "id", label: dashboardData.label(t, "id") },
      {
        key: "entityType",
        label: dashboardData.label(t, "entityType"),
        render: (record) =>
          String(record.entityType) === "topic" ? "话题 (topic)" : "评论 (comment)",
      },
      { key: "entityId", label: dashboardData.label(t, "entityId") },
      { key: "userId", label: dashboardData.label(t, "userId") },
      {
        key: "suggestedAction",
        label: dashboardData.label(t, "suggestedAction"),
      },
      {
        key: "finalAction",
        label: dashboardData.label(t, "finalAction"),
      },
      {
        key: "hitReasons",
        label: dashboardData.label(t, "hitReasons"),
        render: (record) => {
          const reasons = parseJsonArray<string>(record.hitReasons)
          if (reasons.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )
        },
      },
      {
        key: "dimensionResults",
        label: dashboardData.label(t, "dimensionResults"),
        render: (record) => {
          const dimensions = parseJsonArray<ModerationDimensionResult>(
            record.dimensionResults
          )
          if (dimensions.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>
          }
          return (
            <div className="space-y-1.5 text-xs">
              {dimensions.map((dimension, index) => (
                <div
                  key={`${dimension.type || ""}:${dimension.key || index}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {dimension.type || "-"}
                  </Badge>
                  <span className="font-medium">
                    {dimension.label || dimension.key || "-"}
                  </span>
                  <span className="font-mono">
                    {dimension.value || "-"}
                    {dimension.confidence
                      ? ` (${Math.round(dimension.confidence * 100)}%)`
                      : ""}
                  </span>
                  {dimension.description ? (
                    <span className="text-muted-foreground">
                      {dimension.description}
                    </span>
                  ) : null}
                  {moderationVerdictBadge(String(dimension.verdict || ""))}
                </div>
              ))}
            </div>
          )
        },
      },
      {
        key: "isSpamProb",
        label: dashboardData.label(t, "isSpamProb"),
        render: (record) => `${(Number(record.isSpamProb || 0) * 100).toFixed(2)}%`,
      },
      {
        key: "toxicityScore",
        label: dashboardData.label(t, "toxicityScore"),
        render: (record) =>
          `${Number(record.toxicityScore || 0).toFixed(4)} (置信度: ${(Number(record.toxicityConfidence || 0) * 100).toFixed(1)}%)`,
      },
      {
        key: "contentSnapshot",
        label: dashboardData.label(t, "contentSnapshot"),
        render: (record) => dashboardData.codeBlock(record.contentSnapshot),
      },
      {
        key: "rawResponse",
        label: dashboardData.label(t, "rawResponse"),
        render: (record) => dashboardData.codeBlock(record.rawResponse),
      },
      {
        key: "createTime",
        label: dashboardData.label(t, "createTime"),
        render: (record) => dashboardData.dateCell(record.createTime),
      },
    ],
  }

  return <DashboardDataPage config={config} />
}
