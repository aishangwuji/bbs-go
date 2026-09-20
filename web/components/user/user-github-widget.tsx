"use client"

import * as React from "react"
import Link from "@/components/common/link"
import {
  Award,
  Crown,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { WidgetCard } from "@/components/common/widget-card"
import { apiFetch } from "@/lib/api/client"
import type { UserGithubProfile, UserSummary } from "@/lib/api/types"
import { toast } from "@/lib/toast"

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12c0 4.636 3.007 8.566 7.18 9.955.525.098.72-.228.72-.507 0-.25-.01-1.077-.014-1.953-2.92.635-3.536-1.236-3.536-1.236-.477-1.211-1.165-1.534-1.165-1.534-.952-.651.072-.638.072-.638 1.053.074 1.607 1.08 1.607 1.08.936 1.603 2.455 1.14 3.053.872.094-.678.366-1.14.666-1.402-2.33-.265-4.78-1.165-4.78-5.185 0-1.145.41-2.08 1.08-2.815-.108-.265-.468-1.332.103-2.777 0 0 .88-.282 2.88 1.075.835-.232 1.73-.348 2.62-.352.89.004 1.785.12 2.62.352 2-1.357 2.88-1.075 2.88-1.075.571 1.445.211 2.512.103 2.777.67.735 1.08 1.67 1.08 2.815 0 4.03-2.455 4.917-4.79 5.177.376.323.712.96.712 1.935 0 1.397-.013 2.522-.013 2.866 0 .281.19.61.725.507C19.494 20.562 22.5 16.635 22.5 12c0-5.799-4.701-10.5-10.5-10.5z"
      />
    </svg>
  )
}

function formatAge(days: number) {
  if (days <= 0) return "新开发者"
  const years = Math.floor(days / 365)
  if (years >= 1) {
    return `${years} 年开源老兵`
  }
  const months = Math.floor(days / 30)
  if (months >= 1) {
    return `${months} 个月开源开发者`
  }
  return `站龄 ${days} 天`
}

export function UserGithubProfileWidget({
  user,
  currentUser,
}: {
  user: UserSummary
  currentUser?: UserSummary | null
}) {
  const isOwner = currentUser?.id && String(currentUser.id) === String(user.id)
  const [profile, setProfile] = React.useState<UserGithubProfile | null>(
    user.githubProfile || null
  )
  const [syncing, setSyncing] = React.useState(false)

  // 若传入的 user 更新，同步内部状态
  React.useEffect(() => {
    if (user.githubProfile) {
      setProfile(user.githubProfile)
    }
  }, [user.githubProfile])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await apiFetch<UserGithubProfile>("/api/user/sync_github_profile", {
        method: "POST",
      })
      if (res) {
        setProfile(res)
        toast.success("GitHub 开发者画像已同步刷新！")
      }
    } catch (err: any) {
      toast.error(err?.message || "同步 GitHub 画像失败，请确认是否已绑定")
    } finally {
      setSyncing(false)
    }
  }

  // 既无画像又非号主本人，不渲染任何无意义空白占位
  if (!profile && !isOwner) {
    return null
  }

  // 号主本人未绑定 / 未获取画像的引导状态
  if (!profile && isOwner) {
    return (
      <WidgetCard
        title={
          <div className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4 text-foreground" />
            <span>GitHub 开发者认证</span>
          </div>
        }
      >
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 p-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold">点亮开源成就与权威勋章</h4>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            绑定 GitHub 账号，自动同步开源项目 Star 数、合并 PR 贡献与资深开发者勋章。
          </p>
          <Button asChild size="sm" variant="default" className="mt-3.5 h-8 text-xs">
            <Link href={`/user/${user.id}/account`}>
              前往绑定 GitHub
            </Link>
          </Button>
        </div>
      </WidgetCard>
    )
  }

  if (!profile) return null

  const isRepoOwner = profile.proofType === "repo_owner" || (profile.topRepoStars || 0) >= 1000
  const isContributor =
    profile.proofType === "contributor_merged_pr" || (profile.contributedRepoStars || 0) >= 1000

  // 计算当前生效的合并 PR 代表作（优先匹配用户自选）
  const activePR = (() => {
    if (profile.selectedPrUrl && profile.mergedPrs?.length) {
      const found = profile.mergedPrs.find((p) => p.prUrl === profile.selectedPrUrl)
      if (found) return found
    }
    if (profile.contributedRepoName && profile.contributedPrTitle) {
      return {
        repoFullName: profile.contributedRepoName,
        stars: profile.contributedRepoStars || 0,
        prTitle: profile.contributedPrTitle,
        prUrl: profile.contributedPrUrl || "",
      }
    }
    if (profile.mergedPrs?.length) {
      return profile.mergedPrs[0]
    }
    return null
  })()

  return (
    <WidgetCard
      title={
        <div className="flex items-center gap-2">
          <GithubIcon className="h-4 w-4 text-foreground" />
          <span>开源开发者画像</span>
        </div>
      }
      actions={
        isOwner ? (
          <button
            type="button"
            disabled={syncing}
            onClick={handleSync}
            title="刷新同步 GitHub 开发者数据"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
            <span>{syncing ? "同步中" : "刷新"}</span>
          </button>
        ) : null
      }
    >
      <div className="space-y-3.5">
        {/* 1. 用户标识与身份头 */}
        <div className="flex items-center justify-between">
          <a
            href={`https://github.com/${profile.githubLogin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span>@{profile.githubLogin}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            {formatAge(profile.accountAgeDays)}
          </span>
        </div>

        {/* 2. 核心成就与准入勋章条（移除冗余大段提示语，视觉纯净） */}
        {profile.passedAdmission ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2 font-medium">
              {isRepoOwner ? (
                <>
                  <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>1k+ Star 开源项目作者</span>
                </>
              ) : isContributor ? (
                <>
                  <GitMerge className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>顶级开源项目 Contributor</span>
                </>
              ) : (
                <>
                  <Award className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>GitHub 准入认证开发者</span>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* 3. 开源代表作 (Top Repo) */}
        {profile.topRepoName ? (
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <a
                href={profile.topRepoUrl || `https://github.com/${profile.topRepoName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group truncate text-xs font-semibold text-foreground hover:text-primary transition-colors"
              >
                {profile.topRepoName}
              </a>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span>{profile.topRepoStars?.toLocaleString()}</span>
              </span>
            </div>
            {profile.topRepoDesc ? (
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                {profile.topRepoDesc}
              </p>
            ) : null}
            {profile.topRepoLang ? (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary/80" />
                <span>{profile.topRepoLang}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 4. 合并 PR 贡献 (Contributed PR 代表作) */}
        {activePR ? (
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                <GitPullRequest className="h-3 w-3 shrink-0" />
                <span>合并 PR 代表作</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Star className="h-3 w-3 text-amber-500" />
                <span>{activePR.stars?.toLocaleString()}</span>
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-foreground truncate">
              {activePR.repoFullName}
            </p>
            {activePR.prTitle ? (
              <a
                href={activePR.prUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-[11px] text-muted-foreground hover:text-primary transition-colors"
                title={activePR.prTitle}
              >
                #{activePR.prTitle}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </WidgetCard>
  )
}
