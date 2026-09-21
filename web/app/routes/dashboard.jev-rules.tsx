"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  FileCodeIcon,
  FileJsonIcon,
  FlaskConicalIcon,
  InfoIcon,
  LayersIcon,
  ListFilterIcon,
  PercentIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  ScaleIcon,
  Trash2Icon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"

import { adminGet, adminPostJson } from "@/lib/api/admin"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"
import { userHasPermission } from "@/lib/auth/roles"
import { useI18n } from "@/lib/i18n/provider"
import { msgError, msgSuccess } from "@/lib/toast"
import { useCurrentUser } from "@/components/app/app-provider"
import { ErrorPage } from "@/components/common/error-page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

// 结构定义
interface JevNoulQuestion {
  key: string
  label: string
  instructions: string
  rejectThreshold: number
  reviewThreshold: number
  enabled: boolean
}

interface JevScoreQuestion {
  key: string
  label: string
  instructions: string
  criteria: string[]
  rejectThreshold: number
  reviewThreshold: number
  enabled: boolean
}

interface JevChoiceQuestion {
  key: string
  label: string
  instructions: string
  criteria: Record<string, string>
  autoRejectOptions: string[]
  autoReviewOptions: string[]
  enabled: boolean
}

interface JevRuleConfig {
  maxContentLength: number
  includeTitle: boolean
  noulQuestions: JevNoulQuestion[]
  scoreQuestions: JevScoreQuestion[]
  choiceQuestions: JevChoiceQuestion[]
  reviewTimeoutMinutes: number
  reviewTimeoutAction: string
  autoCreateReport: boolean
}

interface SimulationDecision {
  suggestedAction: string
  finalAction: string
  rejectReasons: string[]
  reviewReasons: string[]
  isSpamProb: number
  toxicityScore: number
  toxicityConfidence: number
  choiceResults: Record<string, string>
  rawResponse: string
}

const DEFAULT_CONFIG: JevRuleConfig = {
  maxContentLength: 500,
  includeTitle: true,
  noulQuestions: [
    {
      key: "is_spam",
      label: "垃圾营销广告",
      instructions:
        "Does `title` or `content` contain spam, commercial ads, fraudulent schemes, or prohibited promotional links?",
      rejectThreshold: 0.85,
      reviewThreshold: 0.45,
      enabled: true,
    },
  ],
  scoreQuestions: [
    {
      key: "toxicity",
      label: "攻击辱骂严重度",
      instructions: "How toxic, abusive, or hostile is the tone of this post?",
      criteria: [
        "Civil and rational discussion; friendly or neutral",
        "Mildly uncivil, sarcastic, or slightly provocative, but still technical/relevant",
        "Severe personal attacks, vulgar abuse, hate speech, threats, or explicit harassment",
      ],
      rejectThreshold: 1.5,
      reviewThreshold: 0.8,
      enabled: true,
    },
  ],
  choiceQuestions: [
    {
      key: "violation_category",
      label: "违规类型归类",
      instructions:
        "If this content violates community standards, which category does it primarily belong to?",
      criteria: {
        clean: "No violation found; normal discussion",
        spam_ad: "Unsolicited advertisement, promotional spam, or marketing",
        flame_abuse: "Personal attacks, insults, or harassment",
        illegal_info: "Fraud, gambling, pornography, or prohibited items",
        other: "Other community guideline violations",
      },
      autoRejectOptions: ["illegal_info"],
      autoReviewOptions: ["spam_ad", "flame_abuse"],
      enabled: true,
    },
  ],
  reviewTimeoutMinutes: 120,
  reviewTimeoutAction: "pass",
  autoCreateReport: true,
}

// 辅助生成 Idiomatic Go 结构体代码
function generateGoCode(cfg: JevRuleConfig): string {
  const noulLines = cfg.noulQuestions
    .map(
      (q) => `\t\t\t{
\t\t\t\tKey:             ${JSON.stringify(q.key)},
\t\t\t\tLabel:           ${JSON.stringify(q.label)},
\t\t\t\tInstructions:    ${JSON.stringify(q.instructions)},
\t\t\t\tRejectThreshold: ${q.rejectThreshold},
\t\t\t\tReviewThreshold: ${q.reviewThreshold},
\t\t\t\tEnabled:         ${q.enabled},
\t\t\t},`
    )
    .join("\n")

  const scoreLines = cfg.scoreQuestions
    .map((q) => {
      const criteriaStr =
        q.criteria && q.criteria.length > 0
          ? `[]string{\n` +
            q.criteria.map((c) => `\t\t\t\t\t${JSON.stringify(c)},`).join("\n") +
            `\n\t\t\t\t}`
          : `nil`
      return `\t\t\t{
\t\t\t\tKey:             ${JSON.stringify(q.key)},
\t\t\t\tLabel:           ${JSON.stringify(q.label)},
\t\t\t\tInstructions:    ${JSON.stringify(q.instructions)},
\t\t\t\tCriteria:        ${criteriaStr},
\t\t\t\tRejectThreshold: ${q.rejectThreshold},
\t\t\t\tReviewThreshold: ${q.reviewThreshold},
\t\t\t\tEnabled:         ${q.enabled},
\t\t\t},`
    })
    .join("\n")

  const choiceLines = cfg.choiceQuestions
    .map((q) => {
      const criteriaEntries = Object.entries(q.criteria || {})
        .map(([k, v]) => `\t\t\t\t\t${JSON.stringify(k)}: ${JSON.stringify(v)},`)
        .join("\n")
      const criteriaStr =
        criteriaEntries.length > 0
          ? `map[string]string{\n${criteriaEntries}\n\t\t\t\t}`
          : `nil`
      const rejectOpts =
        q.autoRejectOptions && q.autoRejectOptions.length > 0
          ? `[]string{` +
            q.autoRejectOptions.map((o) => JSON.stringify(o)).join(", ") +
            `}`
          : `nil`
      const reviewOpts =
        q.autoReviewOptions && q.autoReviewOptions.length > 0
          ? `[]string{` +
            q.autoReviewOptions.map((o) => JSON.stringify(o)).join(", ") +
            `}`
          : `nil`

      return `\t\t\t{
\t\t\t\tKey:               ${JSON.stringify(q.key)},
\t\t\t\tLabel:             ${JSON.stringify(q.label)},
\t\t\t\tInstructions:      ${JSON.stringify(q.instructions)},
\t\t\t\tCriteria:          ${criteriaStr},
\t\t\t\tAutoRejectOptions: ${rejectOpts},
\t\t\t\tAutoReviewOptions: ${reviewOpts},
\t\t\t\tEnabled:           ${q.enabled},
\t\t\t},`
    })
    .join("\n")

  return `package dto

// ExportedJevRuleConfig 导出的 Jev 细粒度规则引擎结构体定义
// 可直接用于 Go 后端配置初始化或单元测试 Mock
func ExportedJevRuleConfig() JevRuleConfig {
\treturn JevRuleConfig{
\t\tMaxContentLength:     ${cfg.maxContentLength},
\t\tIncludeTitle:         ${cfg.includeTitle},
\t\tReviewTimeoutMinutes: ${cfg.reviewTimeoutMinutes},
\t\tReviewTimeoutAction:  ${JSON.stringify(cfg.reviewTimeoutAction)},
\t\tAutoCreateReport:     ${cfg.autoCreateReport},
\t\tNoulQuestions: []JevNoulQuestion{
${noulLines}
\t\t},
\t\tScoreQuestions: []JevScoreQuestion{
${scoreLines}
\t\t},
\t\tChoiceQuestions: []JevChoiceQuestion{
${choiceLines}
\t\t},
\t}
}
`
}

// 辅助生成 Jev System One 问询 Payload 结构
function generateJevPayload(cfg: JevRuleConfig) {
  const questions: Record<string, unknown> = {}

  cfg.noulQuestions
    .filter((q) => q.enabled)
    .forEach((q) => {
      questions[q.key] = {
        type: "noul",
        instructions: q.instructions,
      }
    })

  cfg.scoreQuestions
    .filter((q) => q.enabled)
    .forEach((q) => {
      questions[q.key] = {
        type: "score",
        instructions: q.instructions,
        criteria: q.criteria,
      }
    })

  cfg.choiceQuestions
    .filter((q) => q.enabled)
    .forEach((q) => {
      questions[q.key] = {
        type: "choice",
        instructions: q.instructions,
        criteria: q.criteria,
      }
    })

  return {
    model: "jev-latest",
    state: {
      ...(cfg.includeTitle ? { title: "示例标题 (由 Jev 上下文注入)" } : {}),
      content: `示例正文内容快照 (最大截断长度: ${cfg.maxContentLength} 字符)`,
    },
    questions,
  }
}

// 规则配置导出弹窗组件
function ExportConfigDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: JevRuleConfig
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = React.useState<"json" | "go" | "payload">("json")
  const [copied, setCopied] = React.useState(false)

  const jsonCode = React.useMemo(() => JSON.stringify(config, null, 2), [config])
  const goCode = React.useMemo(() => generateGoCode(config), [config])
  const payloadCode = React.useMemo(
    () => JSON.stringify(generateJevPayload(config), null, 2),
    [config]
  )

  const currentContent = React.useMemo(() => {
    switch (activeTab) {
      case "go":
        return goCode
      case "payload":
        return payloadCode
      case "json":
      default:
        return jsonCode
    }
  }, [activeTab, goCode, payloadCode, jsonCode])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopied(true)
      msgSuccess("已成功复制到剪贴板")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      msgError("复制到剪贴板失败，请手动选择复制")
    }
  }

  const handleDownload = () => {
    let filename = `jev-rules-${Date.now()}.json`
    let mimeType = "application/json;charset=utf-8"
    if (activeTab === "go") {
      filename = `jev_rule_config_${Date.now()}.go`
      mimeType = "text/plain;charset=utf-8"
    } else if (activeTab === "payload") {
      filename = `jev-system-one-payload-${Date.now()}.json`
    }

    const blob = new Blob([currentContent], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    msgSuccess(`已成功导出并下载 ${filename}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl font-bold">一键导出规则引擎配置</DialogTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              Go & JSON Dual-Mode
            </Badge>
          </div>
          <DialogDescription>
            支持将当前全量问询与分流处置规则导出为标准 JSON、Idiomatic Go 结构体代码或 Jev 原生问询 Payload，便于离线查阅与研发复现。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-1">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "json" | "go" | "payload")}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-3 sm:flex h-9 p-0.5">
              <TabsTrigger value="json" className="flex items-center justify-center gap-1 text-xs px-2.5">
                <FileJsonIcon className="h-3.5 w-3.5 text-amber-500" />
                <span>JSON</span>
              </TabsTrigger>
              <TabsTrigger value="go" className="flex items-center justify-center gap-1 text-xs px-2.5">
                <FileCodeIcon className="h-3.5 w-3.5 text-cyan-500" />
                <span>Go 结构体</span>
              </TabsTrigger>
              <TabsTrigger value="payload" className="flex items-center justify-center gap-1 text-xs px-2.5">
                <CodeIcon className="h-3.5 w-3.5 text-purple-500" />
                <span>原生 Payload</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8">
              {copied ? (
                <CheckIcon className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? "已复制" : "复制内容"}
            </Button>
            <Button size="sm" onClick={handleDownload} className="h-8">
              <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
              下载文件
            </Button>
          </div>
        </div>

        <div className="relative flex-1 min-h-[300px] max-h-[460px] overflow-hidden rounded-md border bg-muted/40 mt-2">
          <pre className="h-full overflow-auto p-4 font-mono text-xs leading-relaxed select-all">
            <code>{currentContent}</code>
          </pre>
        </div>

        <DialogFooter className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <p className="line-clamp-2 sm:line-clamp-1">
            {activeTab === "go"
              ? "💡 导出的 Go 代码对应 internal/models/dto/config_dto.go 中的 JevRuleConfig 结构。"
              : activeTab === "payload"
              ? "💡 导出的 Payload 结构展示了 bbs-go 调用 Jev System One 模型时实际投递的 questions 映射表。"
              : "💡 导出的 JSON 可直接用于导入系统或与第三方配置平台联动。"}
          </p>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="shrink-0">
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 规则配置一键导入弹窗组件
function ImportConfigDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (imported: JevRuleConfig) => void
}) {
  const [inputText, setInputText] = React.useState("")
  const [parseError, setParseError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = String(event.target?.result || "")
      setInputText(content)
      setParseError(null)
    }
    reader.onerror = () => {
      msgError("读取文件失败，请尝试直接粘贴文件内容")
    }
    reader.readAsText(file, "UTF-8")
    e.target.value = ""
  }

  const validateAndParse = (): JevRuleConfig | null => {
    const trimmed = inputText.trim()
    if (!trimmed) {
      setParseError("请粘贴配置 JSON 或选择文件上传")
      return null
    }

    try {
      const parsed = JSON.parse(trimmed) as Partial<JevRuleConfig>
      if (typeof parsed !== "object" || parsed === null) {
        setParseError("无效的 JSON 对象，请检查格式")
        return null
      }

      // 组装并清洗各字段，提供健壮的缺省容错
      const cleanedConfig: JevRuleConfig = {
        maxContentLength:
          typeof parsed.maxContentLength === "number" && parsed.maxContentLength > 0
            ? parsed.maxContentLength
            : 500,
        includeTitle: parsed.includeTitle !== false,
        reviewTimeoutMinutes:
          typeof parsed.reviewTimeoutMinutes === "number"
            ? parsed.reviewTimeoutMinutes
            : 120,
        reviewTimeoutAction:
          parsed.reviewTimeoutAction === "reject" ? "reject" : "pass",
        autoCreateReport: parsed.autoCreateReport !== false,
        noulQuestions: Array.isArray(parsed.noulQuestions)
          ? parsed.noulQuestions.map((q) => ({
              key: String(q.key || `noul_${Date.now()}`),
              label: String(q.label || "未命名连续概率规则"),
              instructions: String(q.instructions || ""),
              rejectThreshold:
                typeof q.rejectThreshold === "number" ? q.rejectThreshold : 0.85,
              reviewThreshold:
                typeof q.reviewThreshold === "number" ? q.reviewThreshold : 0.45,
              enabled: q.enabled !== false,
            }))
          : [],
        scoreQuestions: Array.isArray(parsed.scoreQuestions)
          ? parsed.scoreQuestions.map((q) => ({
              key: String(q.key || `score_${Date.now()}`),
              label: String(q.label || "未命名阶梯打分规则"),
              instructions: String(q.instructions || ""),
              criteria: Array.isArray(q.criteria)
                ? q.criteria.map(String)
                : [],
              rejectThreshold:
                typeof q.rejectThreshold === "number" ? q.rejectThreshold : 2,
              reviewThreshold:
                typeof q.reviewThreshold === "number" ? q.reviewThreshold : 1,
              enabled: q.enabled !== false,
            }))
          : [],
        choiceQuestions: Array.isArray(parsed.choiceQuestions)
          ? parsed.choiceQuestions.map((q) => ({
              key: String(q.key || `choice_${Date.now()}`),
              label: String(q.label || "未命名离散归类规则"),
              instructions: String(q.instructions || ""),
              criteria:
                typeof q.criteria === "object" && q.criteria !== null
                  ? (q.criteria as Record<string, string>)
                  : {},
              autoRejectOptions: Array.isArray(q.autoRejectOptions)
                ? q.autoRejectOptions.map(String)
                : [],
              autoReviewOptions: Array.isArray(q.autoReviewOptions)
                ? q.autoReviewOptions.map(String)
                : [],
              enabled: q.enabled !== false,
            }))
          : [],
      }

      setParseError(null)
      return cleanedConfig
    } catch (err) {
      setParseError(`JSON 解析失败: ${(err as Error).message}`)
      return null
    }
  }

  const handleApply = () => {
    const validConfig = validateAndParse()
    if (!validConfig) return

    onImport(validConfig)
    onOpenChange(false)
    setInputText("")
    setParseError(null)
    msgSuccess("规则配置已导入至当前编辑态！请检查并点击右上角“保存配置”生效。")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl font-bold">一键导入规则引擎配置</DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              JSON Config Import
            </Badge>
          </div>
          <DialogDescription>
            支持粘贴导出的 Jev 规则 JSON 文本或直接上传 `.json` 配置文件。导入后将即时载入当前页面供预览与编辑，点击右上角“保存配置”后生效。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              粘贴 JSON 规则代码，或从本地选取文件：
            </span>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
                选择本地 JSON 文件
              </Button>
            </div>
          </div>

          <Textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              if (parseError) setParseError(null)
            }}
            placeholder={`{\n  "maxContentLength": 500,\n  "includeTitle": true,\n  "noulQuestions": [...],\n  "scoreQuestions": [...],\n  "choiceQuestions": [...]\n}`}
            className="font-mono text-xs min-h-[260px] max-h-[380px] resize-y"
          />

          {parseError ? (
            <Alert variant="destructive" className="py-2">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle className="text-xs">格式校验未通过</AlertTitle>
              <AlertDescription className="text-xs">{parseError}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <InfoIcon className="h-3.5 w-3.5 text-primary" />
              <span>导入后会完整校验规则结构，并自动合并进 State 变量、Noul、Score 与 Choice 问询列表中。</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setInputText("")
              setParseError(null)
              onOpenChange(false)
            }}
          >
            取消
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInputText("")
                setParseError(null)
              }}
              disabled={!inputText}
            >
              清空
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              <CheckIcon className="mr-1.5 h-4 w-4" />
              确认导入至当前配置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardJevRulesRoute() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const canView = userHasPermission(user, PERMISSIONS.DASHBOARD_JEV_RULE_VIEW)
  const canUpdate = userHasPermission(user, PERMISSIONS.DASHBOARD_JEV_RULE_UPDATE)

  const [config, setConfig] = React.useState<JevRuleConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)

  // Playground 状态
  const [simTitle, setSimTitle] = React.useState("")
  const [simContent, setSimContent] = React.useState(
    "垃圾，什么玩意，纯垃圾，乐色，纯废物，傻逼"
  )
  const [simUseCurrentDraft, setSimUseCurrentDraft] = React.useState(true)
  const [simulating, setSimulating] = React.useState(false)
  const [simResult, setSimResult] = React.useState<SimulationDecision | null>(null)
  const [simRawResponse, setSimRawResponse] = React.useState("")

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminGet<JevRuleConfig>("/api/admin/jev-rule/get")
      if (res) {
        setConfig({
          maxContentLength: res.maxContentLength || 500,
          includeTitle: res.includeTitle !== false,
          noulQuestions: res.noulQuestions || [],
          scoreQuestions: res.scoreQuestions || [],
          choiceQuestions: res.choiceQuestions || [],
          reviewTimeoutMinutes: res.reviewTimeoutMinutes ?? 120,
          reviewTimeoutAction: res.reviewTimeoutAction || "pass",
          autoCreateReport: res.autoCreateReport !== false,
        })
      }
    } catch (err: unknown) {
      const e = err as Error
      msgError(e?.message || "获取 Jev 规则配置失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canView) {
      loadConfig()
    }
  }, [canView, loadConfig])

  if (!canView) {
    return <ErrorPage statusCode={403} message="您没有查看 Jev 规则配置的权限" />
  }

  const handleSave = async () => {
    if (!canUpdate) {
      msgError("您没有修改 Jev 规则配置的权限")
      return
    }
    try {
      setSaving(true)
      await adminPostJson("/api/admin/jev-rule/save", config)
      msgSuccess("Jev 规则引擎配置保存成功")
    } catch (err: unknown) {
      const e = err as Error
      msgError(e?.message || "保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (window.confirm("确定将规则配置重置为系统默认推荐预设吗？")) {
      setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
      msgSuccess("已恢复为默认推荐配置预设，请点击右上角“保存配置”生效")
    }
  }

  const handleSimulate = async () => {
    if (!simContent.trim()) {
      msgError("请输入待仿真的内容文本")
      return
    }
    try {
      setSimulating(true)
      setSimResult(null)
      setSimRawResponse("")

      const payload = {
        title: simTitle,
        content: simContent,
        ruleCfg: simUseCurrentDraft ? config : undefined,
      }

      const res = await adminPostJson<{
        decision: SimulationDecision
        rawResponse: string
      }>("/api/admin/jev-rule/simulate", payload)

      if (res?.decision) {
        setSimResult(res.decision)
        setSimRawResponse(res.rawResponse || res.decision.rawResponse || "")
        msgSuccess("仿真评估完成！")
      }
    } catch (err: unknown) {
      const e = err as Error
      msgError(e?.message || "仿真评测执行失败")
    } finally {
      setSimulating(false)
    }
  }

  // Noul 操作
  const addNoulQuestion = () => {
    setConfig((prev) => ({
      ...prev,
      noulQuestions: [
        ...prev.noulQuestions,
        {
          key: `noul_rule_${Date.now()}`,
          label: "新连续概率问询",
          instructions: "Is this content ...?",
          rejectThreshold: 0.85,
          reviewThreshold: 0.5,
          enabled: true,
        },
      ],
    }))
  }

  const removeNoulQuestion = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      noulQuestions: prev.noulQuestions.filter((_, i) => i !== index),
    }))
  }

  // Score 操作
  const addScoreQuestion = () => {
    setConfig((prev) => ({
      ...prev,
      scoreQuestions: [
        ...prev.scoreQuestions,
        {
          key: `score_rule_${Date.now()}`,
          label: "新阶梯打分问询",
          instructions: "Rate the severity of ...",
          criteria: ["Level 0: None", "Level 1: Moderate", "Level 2: Severe"],
          rejectThreshold: 1.5,
          reviewThreshold: 0.8,
          enabled: true,
        },
      ],
    }))
  }

  const removeScoreQuestion = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      scoreQuestions: prev.scoreQuestions.filter((_, i) => i !== index),
    }))
  }

  // Choice 操作
  const addChoiceQuestion = () => {
    setConfig((prev) => ({
      ...prev,
      choiceQuestions: [
        ...prev.choiceQuestions,
        {
          key: `choice_rule_${Date.now()}`,
          label: "新离散归因分类",
          instructions: "Which category does this violation belong to?",
          criteria: {
            normal: "Normal clean content",
            risk_high: "High risk violation",
          },
          autoRejectOptions: ["risk_high"],
          autoReviewOptions: [],
          enabled: true,
        },
      ],
    }))
  }

  const removeChoiceQuestion = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      choiceQuestions: prev.choiceQuestions.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="space-y-6 p-6">
      {/* 头部标题与保存按钮 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Jev 规则引擎配置</h1>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Speculative Fan-out
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            自主编排 State 上下文变量、Noul 连续概率、Score 阶梯加权、Choice 离散分类及自动化处置流。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            disabled={loading}
          >
            <DownloadIcon className="mr-1.5 h-4 w-4" />
            一键导出配置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            disabled={loading}
          >
            <UploadIcon className="mr-1.5 h-4 w-4" />
            一键导入配置
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={loading || saving}>
            <RefreshCwIcon className="mr-1.5 h-4 w-4" />
            恢复推荐预设
          </Button>
          {canUpdate && (
            <Button size="sm" onClick={handleSave} disabled={loading || saving}>
              <SaveIcon className="mr-1.5 h-4 w-4" />
              {saving ? "保存中..." : "保存配置"}
            </Button>
          )}
        </div>
      </div>

      <ExportConfigDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        config={config}
      />

      <ImportConfigDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={(imported) => {
          setConfig(imported)
        }}
      />

      <Tabs defaultValue="playground" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1">
          <TabsTrigger value="playground" className="flex items-center gap-1.5 py-2">
            <FlaskConicalIcon className="h-4 w-4 text-emerald-500" />
            <span>仿真沙盒 (Playground)</span>
          </TabsTrigger>
          <TabsTrigger value="state" className="flex items-center gap-1.5 py-2">
            <LayersIcon className="h-4 w-4" />
            <span>State 变量</span>
          </TabsTrigger>
          <TabsTrigger value="noul" className="flex items-center gap-1.5 py-2">
            <PercentIcon className="h-4 w-4" />
            <span>Noul 连续概率</span>
          </TabsTrigger>
          <TabsTrigger value="score" className="flex items-center gap-1.5 py-2">
            <ScaleIcon className="h-4 w-4" />
            <span>Score 阶梯打分</span>
          </TabsTrigger>
          <TabsTrigger value="choice" className="flex items-center gap-1.5 py-2">
            <ListFilterIcon className="h-4 w-4" />
            <span>Choice 归因分类</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Playground 在线仿真沙盒 */}
        <TabsContent value="playground" className="space-y-4">
          <Card className="border-emerald-500/20 shadow-sm">
            <CardHeader className="bg-emerald-500/5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
                    <FlaskConicalIcon className="h-5 w-5" />
                    Jev 规则引擎实时仿真沙盒
                  </CardTitle>
                  <CardDescription>
                    在无需向生产业务数据库发布真实帖子的情况下，即时测试当前规则对特定文本的判定结果与各项维度得分。
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Switch
                    id="use-draft"
                    checked={simUseCurrentDraft}
                    onCheckedChange={setSimUseCurrentDraft}
                  />
                  <label htmlFor="use-draft" className="cursor-pointer font-medium">
                    使用本页未保存的草稿规则
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      测试标题 (可选 State.title)
                    </label>
                    <Input
                      value={simTitle}
                      onChange={(e) => setSimTitle(e.target.value)}
                      placeholder="例如：急急急，请问这个怎么解决？"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      测试正文内容 (State.content)
                    </label>
                    <Textarea
                      rows={5}
                      value={simContent}
                      onChange={(e) => setSimContent(e.target.value)}
                      placeholder="输入待测试的评论、文章或帖子正文..."
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSimulate}
                    disabled={simulating}
                  >
                    <PlayIcon className="mr-2 h-4 w-4" />
                    {simulating ? "Jev 模型并行求值中..." : "开始执行 Jev 仿真评测"}
                  </Button>
                </div>

                {/* 仿真评测结果展示区 */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-semibold">综合裁决决策</span>
                      {simResult ? (
                        simResult.finalAction === "pass" ? (
                          <Badge className="bg-emerald-500 text-white gap-1">
                            <CheckCircle2Icon className="h-3.5 w-3.5" /> 放行 (Pass)
                          </Badge>
                        ) : simResult.finalAction === "review" ? (
                          <Badge className="bg-amber-500 text-white gap-1">
                            <AlertTriangleIcon className="h-3.5 w-3.5" /> 待人工审核 (Review)
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircleIcon className="h-3.5 w-3.5" /> 自动驳回拦截 (Reject)
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline">等待运行</Badge>
                      )}
                    </div>

                    {simResult ? (
                      <div className="space-y-3 mt-3">
                        {/* 拦截/审核原因 */}
                        {simResult.rejectReasons.length > 0 && (
                          <Alert variant="destructive" className="py-2 text-xs">
                            <AlertTitle className="text-xs font-bold">触发自动下架规则：</AlertTitle>
                            <AlertDescription className="mt-1 space-y-0.5">
                              {simResult.rejectReasons.map((r, i) => (
                                <div key={i}>• {r}</div>
                              ))}
                            </AlertDescription>
                          </Alert>
                        )}
                        {simResult.reviewReasons.length > 0 && (
                          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 py-2 text-xs">
                            <AlertTitle className="text-xs font-bold">触发人工待审规则：</AlertTitle>
                            <AlertDescription className="mt-1 space-y-0.5">
                              {simResult.reviewReasons.map((r, i) => (
                                <div key={i}>• {r}</div>
                              ))}
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* 各维度指标 */}
                        <div className="space-y-2 text-xs">
                          <div>
                            <div className="flex justify-between font-mono">
                              <span>垃圾营销概率 (is_spam)</span>
                              <span className="font-bold">
                                {(simResult.isSpamProb * 100).toFixed(1)}% ({simResult.isSpamProb.toFixed(4)})
                              </span>
                            </div>
                            <Progress value={simResult.isSpamProb * 100} className="h-1.5 mt-1" />
                          </div>

                          <div>
                            <div className="flex justify-between font-mono">
                              <span>攻击辱骂得分 (toxicity score)</span>
                              <span className="font-bold">
                                {simResult.toxicityScore.toFixed(2)} / 2.0 (置信度:{" "}
                                {(simResult.toxicityConfidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <Progress
                              value={(simResult.toxicityScore / 2) * 100}
                              className="h-1.5 mt-1"
                            />
                          </div>

                          {Object.keys(simResult.choiceResults || {}).length > 0 && (
                            <div className="pt-1">
                              <span className="font-semibold block mb-1">离散归因分类结果：</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(simResult.choiceResults).map(([k, v]) => (
                                  <Badge key={k} variant="secondary" className="font-mono text-[11px]">
                                    {k}: <span className="font-bold ml-1 text-primary">{v}</span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        在左侧输入测试内容并点击“开始执行 Jev 仿真评测”即可在此查看完整的量化指标分布
                      </div>
                    )}
                  </div>

                  {simRawResponse && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-mono flex items-center gap-1">
                        <CodeIcon className="h-3.5 w-3.5" />
                        查看 Jev 原始响应 JSON
                      </summary>
                      <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-black/80 p-2 font-mono text-[10px] text-green-400">
                        {JSON.stringify(JSON.parse(simRawResponse), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: State 变量配置 */}
        <TabsContent value="state" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">State 上下文环境编排</CardTitle>
              <CardDescription>
                Jev 属于统一状态决策模型，它依据传入的 State 字典或文本作为背景知识对后续的所有问询进行一次性推演。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h4 className="font-medium text-sm">单次送审文本最大字符截断数</h4>
                  <p className="text-xs text-muted-foreground">
                    当用户发表长篇文章时，截取前 N 个字符送入 Jev，防止消耗过大的 Token 窗口（默认推荐 500 字）。
                  </p>
                </div>
                <Input
                  type="number"
                  className="w-32 text-right"
                  value={config.maxContentLength}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxContentLength: parseInt(e.target.value, 10) || 500,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">包含标题变量 (State.title)</h4>
                  <p className="text-xs text-muted-foreground">
                    对包含标题的实体（话题、文章），将 State 构造为包含 `title` 和 `content` 的复合 JSON 变量供问询使用。
                  </p>
                </div>
                <Switch
                  checked={config.includeTitle}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeTitle: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* 人工待审时限与工单流转策略 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">人工待审时限与工单流转策略 (Review Timeout & Inbox)</CardTitle>
              <CardDescription>
                打通 Jev 存疑预警与「用户举报 / 审核工单」中枢，并设置超时自动流转时限，避免人工漏审导致全流程死锁阻塞。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h4 className="font-medium text-sm">自动汇入用户举报/审核工单中枢</h4>
                  <p className="text-xs text-muted-foreground">
                    开启后，当 Jev 判定内容存疑待审（StatusReview）时，自动创建一条工单汇入「社区 ➔ 用户举报」中统一处理。
                  </p>
                </div>
                <Switch
                  checked={config.autoCreateReport}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, autoCreateReport: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h4 className="font-medium text-sm">人工审核超时时限（分钟）</h4>
                  <p className="text-xs text-muted-foreground">
                    待审核内容在此时间内若无管理员介入处理，将自动触发兜底处置动作（默认 120 分钟即 2 小时；设为 0 表示不限制）。
                  </p>
                </div>
                <Input
                  type="number"
                  className="w-32 text-right"
                  value={config.reviewTimeoutMinutes}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      reviewTimeoutMinutes: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">超时自动处置策略</h4>
                  <p className="text-xs text-muted-foreground">
                    当超过时限仍未人工处理时执行的兜底决策（推荐“宽容放行上线”，保证正常发帖闭环不卡死）。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={config.reviewTimeoutAction}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        reviewTimeoutAction: e.target.value,
                      }))
                    }
                  >
                    <option value="pass">自动放行解冻 (Fail-Open / 推荐)</option>
                    <option value="reject">自动驳回下架 (Fail-Closed)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Noul 连续概率问询 */}
        <TabsContent value="noul" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Noul 连续概率问询列表</CardTitle>
                <CardDescription>
                  评估二元陈述的真实性，模型直接输出 0.0~1.0 的连续校准概率值（如垃圾广告概率）。
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addNoulQuestion}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                新增 Noul 问询
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.noulQuestions.map((q, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        Noul
                      </Badge>
                      <Input
                        value={q.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.noulQuestions]
                            list[idx] = { ...list[idx], label: val }
                            return { ...prev, noulQuestions: list }
                          })
                        }}
                        className="w-48 font-semibold h-8 text-sm"
                        placeholder="中文展示名"
                      />
                      <Input
                        value={q.key}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.noulQuestions]
                            list[idx] = { ...list[idx], key: val }
                            return { ...prev, noulQuestions: list }
                          })
                        }}
                        className="w-36 font-mono h-8 text-xs text-muted-foreground"
                        placeholder="key (唯一标识)"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Switch
                          checked={q.enabled}
                          onCheckedChange={(checked) => {
                            setConfig((prev) => {
                              const list = [...prev.noulQuestions]
                              list[idx] = { ...list[idx], enabled: checked }
                              return { ...prev, noulQuestions: list }
                            })
                          }}
                        />
                        <span className="text-muted-foreground">启用</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeNoulQuestion(idx)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      评测指令 (Instructions)
                    </label>
                    <Textarea
                      rows={2}
                      value={q.instructions}
                      onChange={(e) => {
                        const val = e.target.value
                        setConfig((prev) => {
                          const list = [...prev.noulQuestions]
                          list[idx] = { ...list[idx], instructions: val }
                          return { ...prev, noulQuestions: list }
                        })
                      }}
                      className="font-mono text-xs"
                      placeholder="向 Jev 描述需要判定的二元命题..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        自动下架驳回阈值 (0.0~1.0，达到即下架)
                      </label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={q.rejectThreshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig((prev) => {
                            const list = [...prev.noulQuestions]
                            list[idx] = { ...list[idx], rejectThreshold: val }
                            return { ...prev, noulQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        自动转人工待审阈值 (0.0~1.0，达到即待审)
                      </label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={q.reviewThreshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig((prev) => {
                            const list = [...prev.noulQuestions]
                            list[idx] = { ...list[idx], reviewThreshold: val }
                            return { ...prev, noulQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-sm mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Score 阶梯打分问询 */}
        <TabsContent value="score" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Score 阶梯打分问询列表</CardTitle>
                <CardDescription>
                  在有序谱系（从轻微到极恶劣）中打分，加权输出连续期望得分与置信度。
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addScoreQuestion}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                新增 Score 问询
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {config.scoreQuestions.map((q, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        Score
                      </Badge>
                      <Input
                        value={q.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.scoreQuestions]
                            list[idx] = { ...list[idx], label: val }
                            return { ...prev, scoreQuestions: list }
                          })
                        }}
                        className="w-48 font-semibold h-8 text-sm"
                        placeholder="中文展示名"
                      />
                      <Input
                        value={q.key}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.scoreQuestions]
                            list[idx] = { ...list[idx], key: val }
                            return { ...prev, scoreQuestions: list }
                          })
                        }}
                        className="w-36 font-mono h-8 text-xs text-muted-foreground"
                        placeholder="key"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Switch
                          checked={q.enabled}
                          onCheckedChange={(checked) => {
                            setConfig((prev) => {
                              const list = [...prev.scoreQuestions]
                              list[idx] = { ...list[idx], enabled: checked }
                              return { ...prev, scoreQuestions: list }
                            })
                          }}
                        />
                        <span className="text-muted-foreground">启用</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeScoreQuestion(idx)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      打分指令 (Instructions)
                    </label>
                    <Textarea
                      rows={2}
                      value={q.instructions}
                      onChange={(e) => {
                        const val = e.target.value
                        setConfig((prev) => {
                          const list = [...prev.scoreQuestions]
                          list[idx] = { ...list[idx], instructions: val }
                          return { ...prev, scoreQuestions: list }
                        })
                      }}
                      className="font-mono text-xs"
                      placeholder="向 Jev 描述打分的目标..."
                    />
                  </div>

                  {/* 阶梯 Criteria */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        阶梯标准 (Criteria，索引 0 到 N)
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => {
                          setConfig((prev) => {
                            const list = [...prev.scoreQuestions]
                            list[idx] = {
                              ...list[idx],
                              criteria: [...list[idx].criteria, "新阶梯等级说明"],
                            }
                            return { ...prev, scoreQuestions: list }
                          })
                        }}
                      >
                        <PlusIcon className="mr-1 h-3 w-3" />
                        添加阶梯
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {q.criteria.map((c, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground w-6">
                            [{cIdx}]
                          </span>
                          <Input
                            value={c}
                            onChange={(e) => {
                              const val = e.target.value
                              setConfig((prev) => {
                                const list = [...prev.scoreQuestions]
                                const newCrit = [...list[idx].criteria]
                                newCrit[cIdx] = val
                                list[idx] = { ...list[idx], criteria: newCrit }
                                return { ...prev, scoreQuestions: list }
                              })
                            }}
                            className="h-7 text-xs font-mono"
                          />
                          {q.criteria.length > 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setConfig((prev) => {
                                  const list = [...prev.scoreQuestions]
                                  const newCrit = list[idx].criteria.filter((_, i) => i !== cIdx)
                                  list[idx] = { ...list[idx], criteria: newCrit }
                                  return { ...prev, scoreQuestions: list }
                                })
                              }}
                            >
                              <Trash2Icon className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        自动下架驳回分值 (达到即下架，默认 1.5)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={q.criteria.length - 1}
                        value={q.rejectThreshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig((prev) => {
                            const list = [...prev.scoreQuestions]
                            list[idx] = { ...list[idx], rejectThreshold: val }
                            return { ...prev, scoreQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        自动转人工待审分值 (达到即待审，默认 0.8)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={q.criteria.length - 1}
                        value={q.reviewThreshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setConfig((prev) => {
                            const list = [...prev.scoreQuestions]
                            list[idx] = { ...list[idx], reviewThreshold: val }
                            return { ...prev, scoreQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-sm mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Choice 离散归因分类 */}
        <TabsContent value="choice" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Choice 离散多分类归因问询</CardTitle>
                <CardDescription>
                  从预设的分类集合中评选出最匹配的违规原因，并根据归类直接触发裁决。
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addChoiceQuestion}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                新增 Choice 问询
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {config.choiceQuestions.map((q, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        Choice
                      </Badge>
                      <Input
                        value={q.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.choiceQuestions]
                            list[idx] = { ...list[idx], label: val }
                            return { ...prev, choiceQuestions: list }
                          })
                        }}
                        className="w-48 font-semibold h-8 text-sm"
                        placeholder="中文展示名"
                      />
                      <Input
                        value={q.key}
                        onChange={(e) => {
                          const val = e.target.value
                          setConfig((prev) => {
                            const list = [...prev.choiceQuestions]
                            list[idx] = { ...list[idx], key: val }
                            return { ...prev, choiceQuestions: list }
                          })
                        }}
                        className="w-36 font-mono h-8 text-xs text-muted-foreground"
                        placeholder="key"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Switch
                          checked={q.enabled}
                          onCheckedChange={(checked) => {
                            setConfig((prev) => {
                              const list = [...prev.choiceQuestions]
                              list[idx] = { ...list[idx], enabled: checked }
                              return { ...prev, choiceQuestions: list }
                            })
                          }}
                        />
                        <span className="text-muted-foreground">启用</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeChoiceQuestion(idx)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      分类指令 (Instructions)
                    </label>
                    <Textarea
                      rows={2}
                      value={q.instructions}
                      onChange={(e) => {
                        const val = e.target.value
                        setConfig((prev) => {
                          const list = [...prev.choiceQuestions]
                          list[idx] = { ...list[idx], instructions: val }
                          return { ...prev, choiceQuestions: list }
                        })
                      }}
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* 选项映射表 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        分类选项映射 (Key ➔ 说明)
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => {
                          const newKey = `opt_${Date.now()}`
                          setConfig((prev) => {
                            const list = [...prev.choiceQuestions]
                            list[idx] = {
                              ...list[idx],
                              criteria: {
                                ...list[idx].criteria,
                                [newKey]: "新选项说明",
                              },
                            }
                            return { ...prev, choiceQuestions: list }
                          })
                        }}
                      >
                        <PlusIcon className="mr-1 h-3 w-3" />
                        添加分类选项
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(q.criteria).map(([optKey, optDesc]) => (
                        <div key={optKey} className="flex items-center gap-2">
                          <Input
                            value={optKey}
                            onChange={(e) => {
                              const newK = e.target.value
                              setConfig((prev) => {
                                const list = [...prev.choiceQuestions]
                                const oldCrit = list[idx].criteria
                                const newCrit: Record<string, string> = {}
                                Object.entries(oldCrit).forEach(([k, v]) => {
                                  if (k === optKey) {
                                    newCrit[newK] = v
                                  } else {
                                    newCrit[k] = v
                                  }
                                })
                                list[idx] = { ...list[idx], criteria: newCrit }
                                return { ...prev, choiceQuestions: list }
                              })
                            }}
                            className="w-36 h-7 text-xs font-mono font-bold"
                          />
                          <Input
                            value={optDesc}
                            onChange={(e) => {
                              const newDesc = e.target.value
                              setConfig((prev) => {
                                const list = [...prev.choiceQuestions]
                                list[idx] = {
                                  ...list[idx],
                                  criteria: {
                                    ...list[idx].criteria,
                                    [optKey]: newDesc,
                                  },
                                }
                                return { ...prev, choiceQuestions: list }
                              })
                            }}
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setConfig((prev) => {
                                const list = [...prev.choiceQuestions]
                                const newCrit = { ...list[idx].criteria }
                                delete newCrit[optKey]
                                list[idx] = { ...list[idx], criteria: newCrit }
                                return { ...prev, choiceQuestions: list }
                              })
                            }}
                          >
                            <Trash2Icon className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        命中即下架的选项（逗号隔开，如 illegal_info）
                      </label>
                      <Input
                        value={q.autoRejectOptions.join(", ")}
                        onChange={(e) => {
                          const val = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                          setConfig((prev) => {
                            const list = [...prev.choiceQuestions]
                            list[idx] = { ...list[idx], autoRejectOptions: val }
                            return { ...prev, choiceQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-xs mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        命中即待审的选项（逗号隔开，如 spam_ad, flame_abuse）
                      </label>
                      <Input
                        value={q.autoReviewOptions.join(", ")}
                        onChange={(e) => {
                          const val = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                          setConfig((prev) => {
                            const list = [...prev.choiceQuestions]
                            list[idx] = { ...list[idx], autoReviewOptions: val }
                            return { ...prev, choiceQuestions: list }
                          })
                        }}
                        className="h-8 font-mono text-xs mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
