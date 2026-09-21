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
          return type === "topic" ? (
            <Badge variant="secondary">话题</Badge>
          ) : (
            <Badge variant="outline">评论</Badge>
          )
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
        key: "isSpamProb",
        label: dashboardData.label(t, "isSpamProb"),
        className: "w-24 text-center",
        render: (record) => {
          const prob = Number(record.isSpamProb || 0)
          const pct = (prob * 100).toFixed(1) + "%"
          if (prob >= 0.7) {
            return <span className="font-semibold text-destructive">{pct}</span>
          }
          if (prob >= 0.3) {
            return <span className="font-medium text-amber-500">{pct}</span>
          }
          return <span className="text-muted-foreground">{pct}</span>
        },
      },
      {
        key: "toxicityScore",
        label: dashboardData.label(t, "toxicityScore"),
        className: "w-24 text-center",
        render: (record) => {
          const score = Number(record.toxicityScore || 0)
          const conf = Number(record.toxicityConfidence || 0)
          const scoreText = score.toFixed(2)
          return (
            <div className="text-xs">
              <span className={score >= 0.7 ? "font-semibold text-destructive" : score >= 0.3 ? "text-amber-500" : "text-muted-foreground"}>
                {scoreText}
              </span>
              {conf > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({Math.round(conf * 100)}%)
                </span>
              )}
            </div>
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
