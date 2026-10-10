// 勋章分级（badge.badgeType）的视觉映射。
// 与后端 constants.BadgeType* 对齐：0 未分级 / 1 铜 / 2 银 / 3 金。
//
// 设计：分级是「纯视觉权重」，数据层只存一个整数，颜色/边框/光环全部在此收敛，
// 这样用户卡、用户侧边栏、徽章页、后台列表用同一套样式，避免各写各的散落 class。
// 用 Tailwind 原子类表达，不新增样式文件、不引依赖。

export const BADGE_TIER_NONE = 0
export const BADGE_TIER_BRONZE = 1
export const BADGE_TIER_SILVER = 2
export const BADGE_TIER_GOLD = 3

// 边框 + 底色：用于图标容器/卡片外框。
const TIER_FRAME: Record<number, string> = {
  [BADGE_TIER_NONE]:
    "border-slate-200/80 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40",
  [BADGE_TIER_BRONZE]:
    "border-orange-300/80 bg-orange-50/70 dark:border-orange-800/60 dark:bg-orange-900/20",
  [BADGE_TIER_SILVER]:
    "border-slate-300 bg-slate-100/70 dark:border-slate-500/60 dark:bg-slate-700/30",
  [BADGE_TIER_GOLD]:
    "border-amber-300 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-900/20",
}

// 光环色：用于「佩戴」勋章的强调描边。
const TIER_RING: Record<number, string> = {
  [BADGE_TIER_NONE]: "ring-slate-300/70",
  [BADGE_TIER_BRONZE]: "ring-orange-400/70",
  [BADGE_TIER_SILVER]: "ring-slate-400/70",
  [BADGE_TIER_GOLD]: "ring-amber-400/80",
}

export function badgeTierFrame(badgeType?: number): string {
  return TIER_FRAME[badgeType ?? BADGE_TIER_NONE] ?? TIER_FRAME[BADGE_TIER_NONE]
}

export function badgeTierRing(badgeType?: number): string {
  return TIER_RING[badgeType ?? BADGE_TIER_NONE] ?? TIER_RING[BADGE_TIER_NONE]
}
