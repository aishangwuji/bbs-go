"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/* =========================================================================
 * Pill Popover (胶囊触发器 + 悬浮选择面板)
 * 遵循通用设计规范：
 * - 触发器：全圆角胶囊 (h-7 rounded-full)，左右留白舒适，箭头反馈
 * - 面板：rounded-[14px]，细边与柔和阴影，内部可滚动 (max-h-[340px])
 * - 行：全圆角胶囊行 (rounded-full)，贴右勾选标与次级提示
 * ========================================================================= */

interface PillPopoverProps extends React.ComponentProps<typeof PopoverPrimitive.Root> {}

function PillPopover({ ...props }: PillPopoverProps) {
  return <PopoverPrimitive.Root data-slot="pill-popover" {...props} />
}

interface PillPopoverTriggerProps
  extends React.ComponentProps<typeof PopoverPrimitive.Trigger> {
  icon?: React.ReactNode
  label?: string
  badge?: React.ReactNode
  chevron?: boolean
}

const PillPopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  PillPopoverTriggerProps
>(({ className, children, icon, label, badge, chevron = true, ...props }, ref) => {
  return (
    <PopoverPrimitive.Trigger
      ref={ref}
      data-slot="pill-trigger"
      className={cn(
        "inline-flex h-7 items-center justify-between gap-1.5 rounded-full border border-border/70",
        "bg-muted/40 hover:bg-muted/80 text-foreground transition-all duration-150",
        "px-3 text-[11.5px] font-medium select-none outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
        "data-[state=open]:bg-muted data-[state=open]:border-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/15",
        "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        {label && (
          <span className="text-muted-foreground text-[11px] font-normal shrink-0">
            {label}:
          </span>
        )}
        <span className="truncate">{children}</span>
        {badge && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary shrink-0">
            {badge}
          </span>
        )}
      </div>
      {chevron && (
        <ChevronDownIcon
          className={cn(
            "size-3 text-muted-foreground/70 shrink-0 transition-transform duration-200 ml-1",
            "group-data-[state=open]:rotate-180"
          )}
          aria-hidden="true"
        />
      )}
    </PopoverPrimitive.Trigger>
  )
})
PillPopoverTrigger.displayName = "PillPopoverTrigger"

interface PillPopoverContentProps
  extends React.ComponentProps<typeof PopoverPrimitive.Content> {
  searchable?: boolean
  searchValue?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
}

const PillPopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PillPopoverContentProps
>(
  (
    {
      className,
      align = "start",
      sideOffset = 6,
      children,
      searchable,
      searchValue,
      onSearchChange,
      searchPlaceholder = "筛选选项...",
      ...props
    },
    ref
  ) => {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          data-slot="pill-popover-content"
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "z-30 flex flex-col rounded-[14px] border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/5 outline-none",
            "min-w-[240px] max-w-[min(420px,82vw)] max-h-[340px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150",
            className
          )}
          {...props}
        >
          {searchable && (
            <div className="p-1 pb-1.5 border-b border-border/40 mb-1">
              <div className="relative flex items-center">
                <SearchIcon className="absolute left-2.5 size-3 text-muted-foreground" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-[26px] pl-7 pr-2 text-xs rounded-full bg-muted/50 border border-border/50 outline-none focus:bg-background focus:border-primary/40 focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
            {children}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    )
  }
)
PillPopoverContent.displayName = "PillPopoverContent"

function PillGroupHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface PillItemProps extends React.ComponentProps<"button"> {
  selected?: boolean
  hint?: React.ReactNode
  icon?: React.ReactNode
}

const PillItem = React.forwardRef<HTMLButtonElement, PillItemProps>(
  ({ className, children, selected, hint, icon, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        className={cn(
          "group/pill-item flex w-full min-h-[28px] items-center gap-2 rounded-full px-2.5 text-xs text-foreground transition-colors select-none",
          "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent",
          selected && "bg-accent/80 font-medium text-foreground",
          disabled && "opacity-45 pointer-events-none cursor-default",
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="truncate flex-1 text-left">{children}</span>
        {hint && (
          <span className="text-[10.5px] text-muted-foreground font-normal shrink-0">
            {hint}
          </span>
        )}
        {selected && (
          <CheckIcon
            className="size-3.5 text-primary shrink-0 ml-1"
            aria-hidden="true"
          />
        )}
      </button>
    )
  }
)
PillItem.displayName = "PillItem"

/* =========================================================================
 * PillSelect (开箱即用的高阶胶囊单选组件)
 * ========================================================================= */

export interface PillSelectOption<T extends string = string> {
  value: T
  label: string
  hint?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface PillSelectGroup<T extends string = string> {
  title?: string
  options: PillSelectOption<T>[]
}

export interface PillSelectProps<T extends string = string> {
  value: T
  onValueChange: (val: T) => void
  options?: PillSelectOption<T>[]
  groups?: PillSelectGroup<T>[]
  label?: string
  placeholder?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  align?: "start" | "end" | "center"
  disabled?: boolean
  className?: string
  contentClassName?: string
  searchable?: boolean
}

export function PillSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  groups,
  label,
  placeholder = "请选择...",
  icon,
  badge,
  align = "start",
  disabled,
  className,
  contentClassName,
  searchable = false,
}: PillSelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // 整理数据列表
  const allGroups = React.useMemo<PillSelectGroup<T>[]>(() => {
    if (groups && groups.length > 0) return groups
    if (options && options.length > 0) {
      return [{ options }]
    }
    return []
  }, [groups, options])

  // 当前选中项文本
  const currentOption = React.useMemo(() => {
    for (const g of allGroups) {
      const found = g.options.find((o) => o.value === value)
      if (found) return found
    }
    return null
  }, [allGroups, value])

  // 搜索过滤
  const filteredGroups = React.useMemo(() => {
    if (!search.trim()) return allGroups
    const q = search.toLowerCase()
    return allGroups
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            (o.hint && o.hint.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.options.length > 0)
  }, [allGroups, search])

  const handleSelect = (val: T) => {
    onValueChange(val)
    setOpen(false)
  }

  return (
    <PillPopover open={open} onOpenChange={setOpen}>
      <PillPopoverTrigger
        icon={icon}
        label={label}
        badge={badge}
        disabled={disabled}
        className={className}
      >
        {currentOption?.label || placeholder}
      </PillPopoverTrigger>
      <PillPopoverContent
        align={align}
        className={contentClassName}
        searchable={searchable}
        searchValue={search}
        onSearchChange={setSearch}
      >
        {filteredGroups.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground select-none">
            无匹配选项
          </div>
        ) : (
          filteredGroups.map((g, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {g.title && <PillGroupHeader>{g.title}</PillGroupHeader>}
              {g.options.map((opt) => (
                <PillItem
                  key={opt.value}
                  selected={opt.value === value}
                  hint={opt.hint}
                  icon={opt.icon}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.label}
                </PillItem>
              ))}
            </div>
          ))
        )}
      </PillPopoverContent>
    </PillPopover>
  )
}

export {
  PillPopover,
  PillPopoverTrigger,
  PillPopoverContent,
  PillGroupHeader,
  PillItem,
}
