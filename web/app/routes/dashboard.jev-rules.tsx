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
  HistoryIcon,
  InfoIcon,
  LayersIcon,
  ListFilterIcon,
  PercentIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  ScaleIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react"

import { adminGet, adminPostJson } from "@/lib/api/admin"
import { PERMISSIONS } from "@/lib/auth/permissions.generated"
import { userHasPermission } from "@/lib/auth/roles"
import { useI18n } from "@/lib/i18n/provider"
import { msgError, msgSuccess } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/components/app/app-provider"
import { ErrorPage } from "@/components/common/error-page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PillPopover,
  PillPopoverContent,
  PillPopoverTrigger,
  PillSelect,
  PillItem,
  PillGroupHeader,
} from "@/components/ui/pill-popover"

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

// 仿真测试样本数据
const PLAYGROUND_SAMPLES = [
  {
    value: "clean",
    label: "正常技术讨论",
    hint: "预期: 放行",
    title: "关于 Go 语言高并发性能优化的实践思考",
    content:
      "在论坛高并发读写场景下，采用 SQLite WAL 模式配合适当的连接池与内存缓存，可以显著压低资源消耗并保持几十微秒级的响应延迟...",
  },
  {
    value: "spam",
    label: "黑灰产引流广告",
    hint: "预期: 垃圾拦截",
    title: "【日赚800元】新手兼职日结到账，名额有限加V",
    content:
      "在家动动手指即可赚钱！无需任何押金，日赚 800+，点击领取专属新人礼包：http://url-demo.xyz/gift 加微信 vip888999 咨询！",
  },
  {
    value: "abuse",
    label: "恶意人身攻击",
    hint: "预期: 毒性拦截",
    title: "楼主脑子纯属有病",
    content:
      "写出这么弱智的代码还敢出来丢人现眼？纯粹是个脑残废物，赶紧滚出社区别在这里恶心大家了！",
  },
  {
    value: "illegal",
    label: "违规涉诈推广",
    hint: "预期: 归因下架",
    title: "信誉第一线上真人视讯娱乐城，大额秒到",
    content:
      "全网最火爆线上平台，百家乐、棋牌竞技、彩票投注，首存送100%，极速出款！官方直达入口：https://bet-demo.example.com",
  },
]

// 预设配置方案
const PRESET_CONFIGS: Record<string, Partial<JevRuleConfig>> = {
  standard: {
    maxContentLength: 500,
    includeTitle: true,
    reviewTimeoutMinutes: 120,
    reviewTimeoutAction: "pass",
    autoCreateReport: true,
  },
  strict: {
    maxContentLength: 800,
    includeTitle: true,
    reviewTimeoutMinutes: 60,
    reviewTimeoutAction: "reject",
    autoCreateReport: true,
  },
  relaxed: {
    maxContentLength: 400,
    includeTitle: true,
    reviewTimeoutMinutes: 240,
    reviewTimeoutAction: "pass",
    autoCreateReport: false,
  },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-bold">导出规则配置</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            导出当前配置为标准 JSON、Go 结构体代码或 Jev 原生 Payload。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-1">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "json" | "go" | "payload")}
          >
            <TabsList className="inline-flex h-8 items-center gap-1 rounded-full bg-muted/50 p-1 border border-border/50">
              <TabsTrigger
                value="json"
                className="rounded-full px-3 py-0.5 text-xs font-medium data-[state=active]:bg-background"
              >
                <FileJsonIcon className="h-3.5 w-3.5 mr-1 text-amber-500" />
                JSON
              </TabsTrigger>
              <TabsTrigger
                value="go"
                className="rounded-full px-3 py-0.5 text-xs font-medium data-[state=active]:bg-background"
              >
                <FileCodeIcon className="h-3.5 w-3.5 mr-1 text-cyan-500" />
                Go 结构体
              </TabsTrigger>
              <TabsTrigger
                value="payload"
                className="rounded-full px-3 py-0.5 text-xs font-medium data-[state=active]:bg-background"
              >
                <CodeIcon className="h-3.5 w-3.5 mr-1 text-purple-500" />
                Jev Payload
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-full h-7 px-3 text-xs">
            {copied ? (
              <>
                <CheckIcon className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                已复制
              </>
            ) : (
              <>
                <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
                复制内容
              </>
            )}
          </Button>
        </div>

        <div className="mt-3 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          <pre className="h-full max-h-[50vh] overflow-auto p-4 font-mono text-xs leading-relaxed select-all">
            {currentContent}
          </pre>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full h-8 px-4 text-xs"
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 规则配置导入弹窗组件
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
              criteria: Array.isArray(q.criteria) ? q.criteria.map(String) : [],
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
    msgSuccess("规则配置已载入当前编辑态，检查无误后点击保存即可生效。")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-bold">导入规则配置</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            粘贴导出的 JSON 规则或上传 .json 配置文件，导入后载入当前草稿。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              配置内容 (JSON)：
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
                className="rounded-full h-7 px-3 text-xs"
              >
                <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
                选择本地文件
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
            className="font-mono text-xs min-h-[220px] max-h-[340px] resize-y"
          />

          {parseError && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle className="text-xs">校验失败</AlertTitle>
              <AlertDescription className="text-xs">{parseError}</AlertDescription>
            </Alert>
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
            className="rounded-full h-8 px-4 text-xs"
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
              className="rounded-full h-8 px-3 text-xs"
            >
              清空
            </Button>
            <Button type="button" size="sm" onClick={handleApply} className="rounded-full h-8 px-4 text-xs">
              <CheckIcon className="mr-1.5 h-4 w-4" />
              确认导入
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 历史版本抽屉
interface JevRuleHistoryRecord {
  id: number
  version: string
  remark: string
  configContent: string
  operatorId: number
  operatorName: string
  isActive: boolean
  createTime: number
}

function HistoryDrawer({
  open,
  onOpenChange,
  onLoadDraft,
  onRollbackSuccess,
  canUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadDraft: (cfg: JevRuleConfig, version: string) => void
  onRollbackSuccess: () => Promise<void>
  canUpdate: boolean
}) {
  const [list, setList] = React.useState<JevRuleHistoryRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [rollingId, setRollingId] = React.useState<number | null>(null)

  const fetchHistory = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminGet<{ results: JevRuleHistoryRecord[] }>(
        "/api/admin/jev-rule/history/list?page=1&limit=50"
      )
      if (res?.results) {
        setList(res.results)
      }
    } catch {
      // 忽略读取错误
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      void fetchHistory()
    }
  }, [open, fetchHistory])

  const handleRollback = async (record: JevRuleHistoryRecord) => {
    if (
      !window.confirm(
        `确定将规则回滚到历史版本【${record.version}】吗？\n该操作将直接生效于线上风控系统。`
      )
    ) {
      return
    }
    try {
      setRollingId(record.id)
      await adminPostJson("/api/admin/jev-rule/history/rollback", {
        historyId: record.id,
      })
      msgSuccess(`已成功回滚至版本 ${record.version}`)
      await onRollbackSuccess()
      await fetchHistory()
    } catch (e: any) {
      msgError(e?.message || "回滚失败")
    } finally {
      setRollingId(null)
    }
  }

  const handleLoadToDraft = (record: JevRuleHistoryRecord) => {
    try {
      const cfg = JSON.parse(record.configContent) as JevRuleConfig
      onLoadDraft(cfg, record.version)
      msgSuccess(`已将版本 ${record.version} 载入草稿`)
      onOpenChange(false)
    } catch {
      msgError("解析历史配置快照失败")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="h-4 w-4 text-primary" />
            历史版本快照
          </SheetTitle>
          <SheetDescription className="text-xs">
            系统自动归档每次保存记录，支持回滚或载入草稿测试。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              加载版本列表中...
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              暂无历史快照版本
            </div>
          ) : (
            list.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3.5 space-y-2 transition-all",
                  item.isActive
                    ? "border-primary/50 bg-primary/5 shadow-xs"
                    : "border-border/70 hover:border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{item.version}</span>
                    {item.isActive && (
                      <Badge className="bg-emerald-600 text-[10px] h-5 rounded-full px-2">
                        当前线上
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatDateTime(item.createTime)}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>操作人: {item.operatorName || `ID ${item.operatorId}`}</span>
                  {item.remark && <span className="truncate max-w-[160px]">{item.remark}</span>}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleLoadToDraft(item)}
                    className="h-7 text-xs rounded-full px-3"
                  >
                    载入草稿
                  </Button>
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant={item.isActive ? "secondary" : "outline"}
                      disabled={item.isActive || rollingId === item.id}
                      onClick={() => handleRollback(item)}
                      className="h-7 text-xs rounded-full px-3"
                    >
                      <RotateCcwIcon className="mr-1 h-3 w-3" />
                      {item.isActive ? "当前版本" : rollingId === item.id ? "回滚中..." : "一键回滚"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [historyDrawerOpen, setHistoryDrawerOpen] = React.useState(false)

  // 预设选择
  const [currentPreset, setCurrentPreset] = React.useState<string>("")

  // Playground 状态
  const [simTitle, setSimTitle] = React.useState("")
  const [simContent, setSimContent] = React.useState("")
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
      msgSuccess("配置保存成功，已同步生成版本快照")
      await loadConfig()
    } catch (err: unknown) {
      const e = err as Error
      msgError(e?.message || "保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const handleApplyPreset = (presetKey: string) => {
    setCurrentPreset(presetKey)
    if (presetKey === "default") {
      setConfig(DEFAULT_CONFIG)
      msgSuccess("已重置为官方默认风控配置")
      return
    }
    const target = PRESET_CONFIGS[presetKey]
    if (target) {
      setConfig((prev) => ({ ...prev, ...target }))
      msgSuccess("已应用预设模板参数")
    }
  }

  const handleLoadSample = (sampleKey: string) => {
    const s = PLAYGROUND_SAMPLES.find((item) => item.value === sampleKey)
    if (s) {
      setSimTitle(s.title)
      setSimContent(s.content)
      msgSuccess(`已载入样本【${s.label}】`)
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
        msgSuccess("仿真评估完成")
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
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        {/* 顶部标题与轻量化操作区 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight">Jev 风控规则配置</h1>
              <Badge variant="secondary" className="font-mono text-[10px] rounded-full px-2 py-0.5">
                v1.2
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              自定义内容安全模型审校维度、判定阈值与审核流转策略
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Pill Popover: 预设方案快速切换 */}
            <PillSelect
              value={currentPreset}
              onValueChange={handleApplyPreset}
              placeholder="预设方案"
              label="预设"
              icon={<SparklesIcon className="size-3 text-amber-500" />}
              className="mr-1"
              groups={[
                {
                  title: "常用配置模板",
                  options: [
                    { value: "standard", label: "标准社区模式", hint: "推荐平衡配置" },
                    { value: "strict", label: "严格防护模式", hint: "降低漏审" },
                    { value: "relaxed", label: "宽松开放模式", hint: "减少人工介入" },
                  ],
                },
                {
                  title: "重置",
                  options: [{ value: "default", label: "官方默认配置", hint: "恢复初值" }],
                },
              ]}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              disabled={loading}
              className="rounded-full h-7 px-3 text-xs"
            >
              <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
              导出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              disabled={loading}
              className="rounded-full h-7 px-3 text-xs"
            >
              <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
              导入
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryDrawerOpen(true)}
              disabled={loading}
              className="rounded-full h-7 px-3 text-xs"
            >
              <HistoryIcon className="mr-1.5 h-3.5 w-3.5" />
              历史版本
            </Button>
            {canUpdate && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading || saving}
                className="rounded-full h-7 px-3.5 text-xs bg-primary hover:bg-primary/90"
              >
                <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "保存中..." : "保存配置"}
              </Button>
            )}
          </div>
        </div>

        {/* 弹窗与抽屉 */}
        <ExportConfigDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          config={config}
        />

        <ImportConfigDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={(imported) => setConfig(imported)}
        />

        <HistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          onLoadDraft={(imported) => {
            setConfig(imported)
            setSimUseCurrentDraft(true)
          }}
          onRollbackSuccess={loadConfig}
          canUpdate={canUpdate}
        />

        {/* 胶囊化主标签导航 (Pill Tabs) */}
        <Tabs defaultValue="playground" className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted/40 p-1 border border-border/60">
              <TabsTrigger
                value="playground"
                className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all flex items-center gap-1.5"
              >
                <FlaskConicalIcon className="h-3.5 w-3.5 text-emerald-500" />
                <span>仿真沙盒</span>
              </TabsTrigger>
              <TabsTrigger
                value="state"
                className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all flex items-center gap-1.5"
              >
                <LayersIcon className="h-3.5 w-3.5 text-blue-500" />
                <span>State 变量</span>
              </TabsTrigger>
              <TabsTrigger
                value="noul"
                className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all flex items-center gap-1.5"
              >
                <PercentIcon className="h-3.5 w-3.5 text-amber-500" />
                <span>Noul 概率</span>
                <span className="text-[10px] text-muted-foreground ml-0.5">({config.noulQuestions.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="score"
                className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all flex items-center gap-1.5"
              >
                <ScaleIcon className="h-3.5 w-3.5 text-indigo-500" />
                <span>Score 打分</span>
                <span className="text-[10px] text-muted-foreground ml-0.5">({config.scoreQuestions.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="choice"
                className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all flex items-center gap-1.5"
              >
                <ListFilterIcon className="h-3.5 w-3.5 text-purple-500" />
                <span>Choice 归因</span>
                <span className="text-[10px] text-muted-foreground ml-0.5">({config.choiceQuestions.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== Tab 1: 仿真沙盒 ==================== */}
          <TabsContent value="playground" className="space-y-4">
            <Card className="border-emerald-500/20 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FlaskConicalIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle className="text-sm font-semibold">规则评测沙盒</CardTitle>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Pill Popover 快捷载入测试样例文本 */}
                    <PillSelect
                      value=""
                      onValueChange={handleLoadSample}
                      placeholder="载入测试样本"
                      label="样本"
                      options={PLAYGROUND_SAMPLES.map((s) => ({
                        value: s.value,
                        label: s.label,
                        hint: s.hint,
                      }))}
                    />

                    <div className="flex items-center gap-2 text-xs">
                      <Switch
                        id="use-draft"
                        checked={simUseCurrentDraft}
                        onCheckedChange={setSimUseCurrentDraft}
                        className="scale-90"
                      />
                      <label htmlFor="use-draft" className="cursor-pointer text-muted-foreground select-none">
                        使用未保存草稿
                      </label>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-foreground">
                          测试标题 <span className="text-muted-foreground font-normal">(可选 State.title)</span>
                        </label>
                      </div>
                      <Input
                        value={simTitle}
                        onChange={(e) => setSimTitle(e.target.value)}
                        placeholder="输入待测试的标题..."
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-foreground">
                          测试正文内容 <span className="text-muted-foreground font-normal">(State.content)</span>
                        </label>
                      </div>
                      <Textarea
                        rows={6}
                        value={simContent}
                        onChange={(e) => setSimContent(e.target.value)}
                        placeholder="输入待评测的帖子、文章或评论正文..."
                        className="font-mono text-xs resize-y"
                      />
                    </div>

                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-8 text-xs font-medium"
                      onClick={handleSimulate}
                      disabled={simulating}
                    >
                      <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
                      {simulating ? "正在并行评测..." : "运行沙盒评测"}
                    </Button>
                  </div>

                  {/* 仿真决策结果 */}
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                        <span className="text-xs font-semibold text-foreground">评测裁决结果</span>
                        {simResult ? (
                          simResult.finalAction === "pass" ? (
                            <Badge className="bg-emerald-600 text-white gap-1 rounded-full text-[11px] h-5 px-2">
                              <CheckCircle2Icon className="h-3 w-3" /> 放行 (Pass)
                            </Badge>
                          ) : simResult.finalAction === "review" ? (
                            <Badge className="bg-amber-500 text-white gap-1 rounded-full text-[11px] h-5 px-2">
                              <AlertTriangleIcon className="h-3 w-3" /> 转人工待审 (Review)
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 rounded-full text-[11px] h-5 px-2">
                              <XCircleIcon className="h-3 w-3" /> 自动驳回下架 (Reject)
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="rounded-full text-[10.5px] font-normal">
                            待评测
                          </Badge>
                        )}
                      </div>

                      {simResult ? (
                        <div className="space-y-3 mt-3">
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

                          <div className="space-y-2.5 text-xs pt-1">
                            <div>
                              <div className="flex justify-between font-mono text-[11px]">
                                <span className="text-muted-foreground">垃圾营销概率</span>
                                <span className="font-semibold">
                                  {(simResult.isSpamProb * 100).toFixed(1)}% ({simResult.isSpamProb.toFixed(3)})
                                </span>
                              </div>
                              <Progress value={simResult.isSpamProb * 100} className="h-1.5 mt-1" />
                            </div>

                            <div>
                              <div className="flex justify-between font-mono text-[11px]">
                                <span className="text-muted-foreground">攻击辱骂得分</span>
                                <span className="font-semibold">
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
                              <div className="pt-2 border-t border-border/40">
                                <span className="text-[11px] text-muted-foreground block mb-1">
                                  离散归因分类结果：
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(simResult.choiceResults).map(([k, v]) => (
                                    <Badge
                                      key={k}
                                      variant="secondary"
                                      className="font-mono text-[11px] rounded-full px-2 py-0.5"
                                    >
                                      {k}: <span className="font-bold ml-1 text-primary">{v}</span>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          在左侧输入测试内容或载入样本后点击评测
                        </div>
                      )}
                    </div>

                    {simRawResponse && (
                      <details className="mt-3 pt-2 border-t border-border/40 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-mono flex items-center gap-1 select-none">
                          <CodeIcon className="h-3 w-3" />
                          查看原始响应 JSON
                        </summary>
                        <pre className="mt-1.5 max-h-36 overflow-auto rounded-lg bg-black/85 p-2.5 font-mono text-[10px] text-emerald-400">
                          {JSON.stringify(JSON.parse(simRawResponse), null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== Tab 2: State 变量与流转 ==================== */}
          <TabsContent value="state" className="space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold">上下文变量设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">单次送审文本字符截断</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        当文章超过该字数时，截取前 N 字符送入模型以节约 Token 窗口。
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-28 text-right h-8 text-xs font-mono"
                      value={config.maxContentLength}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxContentLength: parseInt(e.target.value, 10) || 500,
                        }))
                      }
                    />
                    <span className="text-xs text-muted-foreground">字</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">包含标题变量 (State.title)</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        话题、文章等带有标题的实体，模型将综合标题与正文进行一致性评估。
                      </TooltipContent>
                    </Tooltip>
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

            <Card>
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold">人工审核超时流转策略</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">自动汇入用户举报工单</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        命中待审规则时，自动创建待处理举报工单，方便在“用户举报”统一流转。
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={config.autoCreateReport}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, autoCreateReport: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">人工审核超时时限</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        待审核内容超过此时限若无人工介入，执行预设处置；设为 0 表示永不超时。
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-28 text-right h-8 text-xs font-mono"
                      value={config.reviewTimeoutMinutes}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          reviewTimeoutMinutes: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                    <span className="text-xs text-muted-foreground">分钟</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">超时自动处置策略</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        推荐宽容放行 (Fail-Open)，避免因运营未及时审核造成用户正向发帖被永久冻结。
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Pill Popover 替换原生 select */}
                  <PillSelect
                    value={config.reviewTimeoutAction}
                    onValueChange={(val) =>
                      setConfig((prev) => ({ ...prev, reviewTimeoutAction: val }))
                    }
                    label="处置"
                    options={[
                      { value: "pass", label: "自动放行解冻", hint: "Fail-Open (推荐)" },
                      { value: "reject", label: "自动驳回下架", hint: "Fail-Closed" },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== Tab 3: Noul 连续概率问询 ==================== */}
          <TabsContent value="noul" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Noul 连续概率问询</CardTitle>
                  <span className="text-xs text-muted-foreground font-normal">
                    (输出 0.0~1.0 连续概率)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addNoulQuestion}
                  className="rounded-full h-7 px-3 text-xs"
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  新增问询
                </Button>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-4">
                {config.noulQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/70 p-3.5 space-y-3 bg-card shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px] rounded-full px-2">
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
                          className="w-44 font-semibold h-7 text-xs"
                          placeholder="规则名称"
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
                          className="w-32 font-mono h-7 text-[11px] text-muted-foreground"
                          placeholder="key"
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
                            className="scale-90"
                          />
                          <span className="text-xs text-muted-foreground">启用</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive h-7 w-7 rounded-full"
                          onClick={() => removeNoulQuestion(idx)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                        模型问询提示词 (Instructions)
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
                        placeholder="向模型描述判定命题..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-muted-foreground font-medium">
                            自动下架阈值
                          </label>
                          <span className="text-[11px] font-mono text-destructive">
                            {(q.rejectThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
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
                          className="h-7 font-mono text-xs mt-1"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-muted-foreground font-medium">
                            转待审阈值
                          </label>
                          <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                            {(q.reviewThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
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
                          className="h-7 font-mono text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== Tab 4: Score 阶梯打分问询 ==================== */}
          <TabsContent value="score" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Score 阶梯打分问询</CardTitle>
                  <span className="text-xs text-muted-foreground font-normal">
                    (根据有序阶梯等级加权打分)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addScoreQuestion}
                  className="rounded-full h-7 px-3 text-xs"
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  新增打分
                </Button>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-4">
                {config.scoreQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/70 p-3.5 space-y-3 bg-card shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px] rounded-full px-2">
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
                          className="w-44 font-semibold h-7 text-xs"
                          placeholder="打分名称"
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
                          className="w-32 font-mono h-7 text-[11px] text-muted-foreground"
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
                            className="scale-90"
                          />
                          <span className="text-xs text-muted-foreground">启用</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive h-7 w-7 rounded-full"
                          onClick={() => removeScoreQuestion(idx)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                        打分提示词 (Instructions)
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
                      />
                    </div>

                    {/* 阶梯 Criteria */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          等级阶梯 (Criteria 0 ~ N)
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] rounded-full px-2"
                          onClick={() => {
                            setConfig((prev) => {
                              const list = [...prev.scoreQuestions]
                              list[idx] = {
                                ...list[idx],
                                criteria: [...list[idx].criteria, "新等级定义"],
                              }
                              return { ...prev, scoreQuestions: list }
                            })
                          }}
                        >
                          <PlusIcon className="mr-1 h-3 w-3" />
                          增加阶梯
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {q.criteria.map((c, cIdx) => (
                          <div key={cIdx} className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-muted-foreground w-6 text-center">
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
                                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full"
                                onClick={() => {
                                  setConfig((prev) => {
                                    const list = [...prev.scoreQuestions]
                                    const newCrit = list[idx].criteria.filter(
                                      (_, i) => i !== cIdx
                                    )
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
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-muted-foreground font-medium">
                            自动下架分值 (≥ 阈值)
                          </label>
                          <span className="text-[11px] font-mono text-destructive">
                            {q.rejectThreshold.toFixed(1)}
                          </span>
                        </div>
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
                          className="h-7 font-mono text-xs mt-1"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-muted-foreground font-medium">
                            转待审分值 (≥ 阈值)
                          </label>
                          <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                            {q.reviewThreshold.toFixed(1)}
                          </span>
                        </div>
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
                          className="h-7 font-mono text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== Tab 5: Choice 离散归因分类 ==================== */}
          <TabsContent value="choice" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Choice 归因分类问询</CardTitle>
                  <span className="text-xs text-muted-foreground font-normal">
                    (匹配离散分类并触发处置)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addChoiceQuestion}
                  className="rounded-full h-7 px-3 text-xs"
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  新增分类
                </Button>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-4">
                {config.choiceQuestions.map((q, idx) => {
                  const criteriaKeys = Object.keys(q.criteria)

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/70 p-3.5 space-y-3 bg-card shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] rounded-full px-2">
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
                            className="w-44 font-semibold h-7 text-xs"
                            placeholder="分类名称"
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
                            className="w-32 font-mono h-7 text-[11px] text-muted-foreground"
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
                              className="scale-90"
                            />
                            <span className="text-xs text-muted-foreground">启用</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive h-7 w-7 rounded-full"
                            onClick={() => removeChoiceQuestion(idx)}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                          分类问询提示词 (Instructions)
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
                          <label className="text-[11px] font-medium text-muted-foreground">
                            类别选项 (Key ➔ 描述说明)
                          </label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] rounded-full px-2"
                            onClick={() => {
                              const newKey = `opt_${Date.now()}`
                              setConfig((prev) => {
                                const list = [...prev.choiceQuestions]
                                list[idx] = {
                                  ...list[idx],
                                  criteria: {
                                    ...list[idx].criteria,
                                    [newKey]: "新分类定义",
                                  },
                                }
                                return { ...prev, choiceQuestions: list }
                              })
                            }}
                          >
                            <PlusIcon className="mr-1 h-3 w-3" />
                            添加类别
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
                                className="w-32 h-7 text-xs font-mono font-medium"
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
                                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full"
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

                      {/* Pill Popover 选择直接下架与待审选项 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                        {/* 直接下架项 */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-destructive flex items-center gap-1">
                              直接下架类别
                            </label>

                            {/* Pill Popover 勾选添加 */}
                            <PillPopover>
                              <PillPopoverTrigger className="h-6 px-2 text-[10.5px]">
                                + 添加
                              </PillPopoverTrigger>
                              <PillPopoverContent align="end" className="w-56">
                                <PillGroupHeader>可选类别</PillGroupHeader>
                                {criteriaKeys.map((k) => {
                                  const isSelected = q.autoRejectOptions.includes(k)
                                  return (
                                    <PillItem
                                      key={k}
                                      selected={isSelected}
                                      hint={q.criteria[k]}
                                      onClick={() => {
                                        setConfig((prev) => {
                                          const list = [...prev.choiceQuestions]
                                          const current = list[idx].autoRejectOptions
                                          const next = isSelected
                                            ? current.filter((x) => x !== k)
                                            : [...current, k]
                                          list[idx] = { ...list[idx], autoRejectOptions: next }
                                          return { ...prev, choiceQuestions: list }
                                        })
                                      }}
                                    >
                                      {k}
                                    </PillItem>
                                  )
                                })}
                              </PillPopoverContent>
                            </PillPopover>
                          </div>

                          <div className="flex flex-wrap gap-1 min-h-[30px] p-1.5 rounded-lg border border-border/50 bg-muted/20 items-center">
                            {q.autoRejectOptions.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic px-1">
                                无
                              </span>
                            ) : (
                              q.autoRejectOptions.map((opt) => (
                                <Badge
                                  key={opt}
                                  variant="destructive"
                                  className="rounded-full text-[10.5px] font-mono py-0 pl-2 pr-1 h-5 gap-1 flex items-center"
                                >
                                  <span>{opt}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfig((prev) => {
                                        const list = [...prev.choiceQuestions]
                                        list[idx] = {
                                          ...list[idx],
                                          autoRejectOptions: list[idx].autoRejectOptions.filter(
                                            (x) => x !== opt
                                          ),
                                        }
                                        return { ...prev, choiceQuestions: list }
                                      })
                                    }}
                                    className="hover:opacity-80 rounded-full"
                                  >
                                    <XIcon className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>

                        {/* 转人工待审项 */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              转人工待审类别
                            </label>

                            {/* Pill Popover 勾选添加 */}
                            <PillPopover>
                              <PillPopoverTrigger className="h-6 px-2 text-[10.5px]">
                                + 添加
                              </PillPopoverTrigger>
                              <PillPopoverContent align="end" className="w-56">
                                <PillGroupHeader>可选类别</PillGroupHeader>
                                {criteriaKeys.map((k) => {
                                  const isSelected = q.autoReviewOptions.includes(k)
                                  return (
                                    <PillItem
                                      key={k}
                                      selected={isSelected}
                                      hint={q.criteria[k]}
                                      onClick={() => {
                                        setConfig((prev) => {
                                          const list = [...prev.choiceQuestions]
                                          const current = list[idx].autoReviewOptions
                                          const next = isSelected
                                            ? current.filter((x) => x !== k)
                                            : [...current, k]
                                          list[idx] = { ...list[idx], autoReviewOptions: next }
                                          return { ...prev, choiceQuestions: list }
                                        })
                                      }}
                                    >
                                      {k}
                                    </PillItem>
                                  )
                                })}
                              </PillPopoverContent>
                            </PillPopover>
                          </div>

                          <div className="flex flex-wrap gap-1 min-h-[30px] p-1.5 rounded-lg border border-border/50 bg-muted/20 items-center">
                            {q.autoReviewOptions.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic px-1">
                                无
                              </span>
                            ) : (
                              q.autoReviewOptions.map((opt) => (
                                <Badge
                                  key={opt}
                                  className="rounded-full text-[10.5px] font-mono py-0 pl-2 pr-1 h-5 gap-1 flex items-center bg-amber-500 hover:bg-amber-600 text-white"
                                >
                                  <span>{opt}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfig((prev) => {
                                        const list = [...prev.choiceQuestions]
                                        list[idx] = {
                                          ...list[idx],
                                          autoReviewOptions: list[idx].autoReviewOptions.filter(
                                            (x) => x !== opt
                                          ),
                                        }
                                        return { ...prev, choiceQuestions: list }
                                      })
                                    }}
                                    className="hover:opacity-80 rounded-full"
                                  >
                                    <XIcon className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
