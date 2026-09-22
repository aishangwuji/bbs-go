---
title: bbs-go 项目业务全景与工程认知
last_verified: 2026-08-11
---

<!-- __SYSMAP_INDEX__ -->
## 文档索引（index_updated: 2026-09-20）
| 行号 | 主题 |
|------|------|
| L23-L31 |   一、项目定位与仓库关系 |
| L32-L40 |   二、技术栈（重要认知，与旧版文档不同） |
| L41-L50 |   三、CI/CD 与部署模型（2026-08-08 起） |
| L51-L60 |     3.1 fork 与上游的 CI/CD 关系（2026-08-08 merge 后） |
| L61-L62 |   四、业务规则与已修复问题（本 fork 特有） |
| L63-L74 |     4.1 用户发帖/评论计数一致性（PR #297） |
| L75-L81 |     4.2 评论输入框 Firefox 显示 bug（PR #301） |
| L82-L100 |     4.3 Agent 接入模块（Agent Gateway，2026-08-11 新增） |
| L102-L115 |     4.4 个性签名（Signature，2026-09-18 新增） |
| L118-L125 |     4.5 用户悬浮卡片（User Card，2026-09-19 新增） |
| L127-L134 |     4.6 多语言（i18n，2026-09-19 新增） |
| L136-L141 |     4.7 用户中心嵌套布局路由（2026-09-20 新增） |
| L144-L149 |     4.8 资料/账号设置内嵌为个人主页 Tab（2026-09-20 新增） |
| L150-L151 |   五、开发注意（本仓库约定） |
| L152-L158 |     5.1 分支工作流（2026-08-08 整理后） |
| L160-L164 |     5.2 其他开发约定 |
<!-- __SYSMAP_INDEX_END__ -->

## 一、项目定位与仓库关系

- `bbs-go` 是一个轻量级社区/问答平台（Go 后端 + Web 前端），上游主仓库为 `mlogclub/bbs-go`。
- **本地协作模型为 fork 工作流**：
  - `origin` = 上游 `https://github.com/mlogclub/bbs-go.git`（只读，PR 目标）
  - `fork` = 自有仓库 `https://github.com/aishangwuji/bbs-go.git`（日常开发与 CI/CD 触发源）
- **生产环境只从 fork 拉取部署**，不直接使用上游镜像。
- 服务器上的源码检出：`/opt/bbs-go/repo/`（remote 指向 fork）。

## 二、技术栈（重要认知，与旧版文档不同）

- 后端：Go（`cmd/`、`internal/`，gin + gorm），SQLite 为主。
- 前端：**`web/` 目录为 React Router v7 + Vite + shadcn/ui + Tailwind v4**（`pnpm` 管理，2026 年由 Nuxt 重构而来）。
  - 组件库：`web/components/ui/`（shadcn）、`web/components/comment/`（评论）、`web/components/editor/`（富文本）等。
  - 评论输入框组件：`web/components/comment/text-editor.tsx`。
  - 样式：Tailwind v4 + `web/styles/`（含 editor.css，注意其中 `.simple-editor` 用于发帖/文章编辑器，评论框不用它）。
- 变更前端代码后必须跑：`pnpm typecheck` 与 `pnpm lint`（在 `web/` 下）。

## 三、CI/CD 与部署模型（2026-08-08 起）

- **构建在 GitHub Actions 云端完成，服务器不再本地编译**（2核4G 撑不住 `docker build`）。
- 触发：push 到 fork 的 `master` 分支 → `.github/workflows/docker-image.yml` → 多阶段 Dockerfile 构建 → 推送 GHCR。
- 镜像：`ghcr.io/aishangwuji/bbs-go:latest` + `sha-<commit>`（仓库为 PUBLIC，服务器可匿名拉取）。
- 服务器部署：`bash /opt/bbs-go/repo/deploy/remote-deploy.sh`（pull → 校验 compose → 重建 → 健康检查）。
- 回滚：`docker pull ghcr.io/aishangwuji/bbs-go:sha-<commit>` + `docker compose -f /opt/bbs-go/docker-compose.yml up -d --no-deps`。
- 服务器架构细节（nginx SNI 分流、端口、证书等）：见服务器 `/opt/server-architecture.md`（每次改动服务器服务必须同步更新）。
- 完整流程说明已写入仓库 `README.md` / `README.en-US.md`。

### 3.1 fork 与上游的 CI/CD 关系（2026-08-08 merge 后）

- 已 merge 上游 15 个提交，**无冲突**，自动合并 23 个文件。
- merge 后保留三个 workflow：
  - `docker-image.yml`：**我们的 GHCR 自动版**（push master 触发，merge 时 git 自动保留了 fork 版本，未被上游覆盖）——核心流水线。
  - `ghcr.yml`：上游手动触发版（workflow_dispatch，可指定 tag 构建多版本）——保留，与自动版不冲突。
  - `main.yml`：上游跨平台二进制发布版（打 v* tag 触发，发布 tar.gz 到 GitHub Release）——保留，供终端用户装包，不影响服务器部署。
- **决策**：上游无 push-master 自动推 GHCR 的 workflow，因此我们的自动流水线不可被上游替代。merge 后必须保留 fork 版 `docker-image.yml`，否则 CI 失联、服务器无法自动部署。
- merge 带入的上游新能力：通用 S3 兼容存储（`internal/pkg/uploader/s3_uploader.go`，支持 R2/MinIO/RustFS）、帖子审核开关（`SysConfigService.IsTopicPending`）、Makefile 打包目标、web/embed 路由优化、安装中间件专用状态码。

## 四、业务规则与已修复问题（本 fork 特有）

### 4.1 用户发帖/评论计数一致性（PR #297）

- 业务规则：`t_user.topic_count` / `comment_count` 必须与「已发布（status=0）」的帖子/评论数量一致。
- 历史问题：删除/待审核未正确扣减或计入，导致积分排行与角色框数量不符。
- 修复策略（运行时增减计数，已合入 fork master）：
  - 待审核帖子发布时**不计**入 `topic_count`，审核通过（`TopicService.Audit`）后 +1。
  - 删除已发布帖子 -1（仅当原状态为已发布）；恢复（Undelete）+1。
  - 评论删除 -1；发布 +1。
  - 计数增减用 `CASE WHEN n > 0 THEN n - 1 ELSE 0 END` 防负。
- **审阅人意见**：不要用启动 migration 全表重算（大数据量会卡死启动），历史数据手动在数据库执行。因此 `migrations/000016_*` 相关文件已从 PR 移除。
- 对应测试：`internal/services/topic_count_test.go`。

### 4.2 评论输入框 Firefox 显示 bug（PR #301）

- 现象：帖子详情页评论输入框 placeholder 遮挡「发表」与上传按钮，**仅 Firefox**。
- 根因：`text-editor.tsx` 固定高度 flex 容器中，Firefox 的 `<textarea>` `min-height:auto` 按固有高度计算，无法收缩，顶出工具条。
- 修复：textarea 加 `min-h-0`；工具条与图片区加 `shrink-0`。
- 上线验证方式：检查 CSS 产物中 `.min-h-0` 规则是否生成（`min-height:calc(var(--spacing) * 0)`）。

### 4.3 Agent 接入模块（Agent Gateway，2026-08-11 新增）

- **目标**：把管理端能力抽象为 Agent 可调用的 REST 网关，用 `X-agent-token` 鉴权，后台按能力白名单授权，供 AI Agent 自动化运营。
- **架构**：
  - 能力注册表 `internal/permissions/agent_capabilities.go`：`server` 启动时从 gin 路由表快照所有 `/api/admin/**` 路由，用 `adminPermissionRules` 映射权限码，派生能力集。**单一数据源**（不另维护副本），新接口上线后自动出现在能力集。
  - 网关 `internal/server/agent_gateway.go`：为每个能力注册 `/api/agent/<path>`，与 `/api/admin/<path>` 一一对应；`middleware.AgentTokenMiddleware` 校验令牌并注入创建人身份；`agentCapabilityHandler` 校验白名单（未授权返回 errorCode=2）；写操作（非 GET）以创建人为操作者写操作日志。
  - 令牌模型 `t_agent_token`（只存 sha256 哈希，明文创建时仅返回一次）+ `t_agent_token_api`（method+path 白名单）。
  - 管理接口 `/api/admin/agent-token/**`：列表/详情/创建/更新/删除/能力清单/授权。**该组接口被能力注册表硬性排除**，绝不暴露给 Agent（防自提权）。
  - 权限码：`dashboard.agentToken.view/create/update/delete`（GroupSystem，SortNo 1400+），生成前端 `permissions.generated.ts`。
  - 授权约束：管理员只能授予**自己权限范围内**的能力（owner 除外），防越权放权。
- **规则**：
  - 新接口部署后默认不在任何令牌白名单内，需管理员在后台「Agent 接入」勾选授权。
  - 仅「有权限映射」的管理接口才成为能力；无权限映射的辅助路由（dict/vote 等）不对 Agent 开放。
  - 安全边界：无/错/吊销令牌 → errorCode=1；未授权 → errorCode=2；agent-token 管理路径 → 不存在。
- **前端**：`web/app/routes/dashboard.agent-tokens.tsx`（后台「系统 → Agent 接入」），支持创建（令牌一次性展示+复制）、能力授权勾选、吊销/删除。
- **文档**：`docs/agent-access-skill.md` 为 Agent 调用指南。
- **测试**：`internal/permissions/agent_capabilities_test.go`、`internal/services/agent_token_service_test.go`、`internal/server/agent_gateway_test.go`（鉴权/白名单/防自提权/新路由默认拒）、`internal/handlers/admin/agent_token_handlers_test.go`（越权放权拒绝）。
- **注意**：能力集在 `newRouter()` 时构建并写入 `permissions` 包全局；仅在有权限映射的路由快照下生成，agent-token 前缀硬排除。

### 4.4 个性签名（Signature，2026-09-18 新增）

- **目标**：楼层（评论）与帖子正文下方展示用户个性签名，支持 Markdown（超链接/加粗/图片），按等级门槛由管理员配置开放。
- **存储**：`t_user.signature`（TEXT，存 **Markdown 原文**，由 `AutoMigrate` 加列）；评论表**不冗余**签名，仅存 `user_id`。
- **渲染链路**：`internal/pkg/markdown/utils.go` `ToSignatureHTML` = `lute` Markdown → `bluemonday` **严格白名单**：
  - 仅允许 `p/span/strong/em/code/pre/blockquote/del/ul/ol/li/br/a/img`
  - **刻意剔除** `h1-h6`（防大标题破坏版面）、`script/iframe`、`on*` 事件
  - 链接仅 `http(s)`，强制 `rel="noreferrer noopener" target="_blank"`；图片限高
- **关联输出**：`internal/handlers/render/user_render.go` `BuildUserInfo` 注入 `signature` + `signatureHtml`，评论/帖子响应中的 `user` 自动携带。
- **门槛配置**：`t_sys_config.signatureMinLevel`（默认 3，`0` 表示不限），后台 **系统 → 站点设置 → 页面 → 个性签名** 配置；用户侧 `dashboard.settings.tsx` `PageSettings`。
- **前端**：`web/components/common/signature.tsx`（通用组件）、`comment/index.tsx`（楼层）、`topic-detail-client-page.tsx`（帖子）；样式 `web/styles/content.css` `.bbs-signature`（虚线分隔 + 12px 褪色 + `max-height:60px` + 图片 `30px`）。个人设置 `web/components/user/profile-form.tsx` 含等级闸门/200 字上限/Markdown 提示。
- **治理**：管理员可在 后台用户管理 编辑/清空签名（`AdminUserUpdateReq.Signature`，限 200 字符）。
- **测试**：`internal/pkg/markdown/signature_test.go` 覆盖 `script`/`javascript:` 伪协议/`iframe`/`onclick`/`h1` 拦截与安全链接保留。
- **⚠️ 迁移版本坑**：本功能迁移必须用 **version 17**。生产库 `t_migration` 残留 `16 = "sync user topic/comment counts"`（文件已从仓库移除但 `success=1` 记录仍在），若复用 16 会被 `runMigration` 判定已成功而**静默跳过**。`migrations/migration.go` 已加注释警戒。

### 4.5 用户悬浮卡片（User Card，2026-09-19 新增）

- **目标**：悬浮头像/昵称弹出用户资料卡（Discourse 风格），展示基础信息 + 已获得勋章 + 关注入口。
- **接口**：`GET /api/user/:id/card`（`internal/handlers/api/user_handlers.go` `UserCard`）→ `resp.UserCardResponse`（内嵌 `UserInfo` + `Badges` + `BadgeCount` + `Followed`）。
- **聚合与性能**：`idcodec.Decode` 校验 → `cache.UserCache` → `render.BuildUserInfo`（复用等级/脱敏）→ `cache.UserBadgeCache` + `cache.BadgeCache` 关联**已获得**勋章（佩戴优先、其次 sortNo，map 索引 O(n)）→ `UserFollowService.IsFollowed` 注入当前登录用户关注态。全程内存缓存，无新增回源 SQL。
- **前端**：`web/components/user/user-hover-card.tsx`，复用既有 `web/components/ui/hover-card.tsx`（Radix，内置 Portal + floating-ui 边界翻转），**不引入新依赖**。模块级 60s 短缓存 + inflight 请求合并 + 请求序号竞态保护（防快速切换用户时旧响应覆盖新卡片）；**缓存键含观看者身份**（`viewer:user`），避免 `followed` 跨登录态污染。
- **接入状态**：已接入评论楼层（`web/components/comment/index.tsx` 主楼层/子楼层的头像与昵称、子楼层引用对象昵称）。其他页面按需用 `UserHoverCard` 包裹 `UserAvatar`/昵称即可。
- **测试**：`internal/handlers/api/user_card_test.go`（只返回已获得勋章、佩戴优先排序、空数组非 null）；`internal/server/router_test.go` 含路由注册断言。

### 4.6 多语言（i18n，2026-09-19 新增）

- **范围**：前端用户界面语言，新增 `de-DE / fr-FR / ja-JP / ko-KR / ru-RU`（共 7 种，含既有 en-US、zh-CN）。
- **接线**：`web/lib/i18n/index.ts`（`Locale` 类型 + `messages` + i18next `resources`；`matchLocale` 支持主语言前缀匹配，`normalizeLocale` 兜底 en-US）；`web/app/route-helpers/locale.ts` `getBrowserLocale` 按 `navigator.languages` 自动选择；`web/components/language-toggle.tsx` 语言切换项。
- **站点语言 vs 用户语言**：安装向导仍只提供 en-US/zh-CN（站点语言，后端 `locales/*.yml` 仅此两种）；用户可在页头切换其余语言，仅影响前端文案，后端错误/默认文案仍走站点语言。
- **修复**：`web/lib/seo.ts` `localizedTitle` 原来「非 en-US 即中文」，新语言会显示中文 meta，已改为「仅 zh-CN 走中文，其余回退英文」。
- **文案**：5 个语言包补齐用户卡 `component.userCard.*`。

### 4.7 用户中心嵌套布局路由（2026-09-20 新增）

- **目标**：修复个人中心切 tab 闪烁。原先 5 个分区是独立顶层路由（`user_.$userId.*` 非嵌套），每次切换都整页重建外壳（横幅/侧边栏）+ `useRouteData` 空白占位 + 重复取数。
- **结构**：`user.$userId.tsx` 改为布局路由（一次拉取外壳 `UserCenterData` + 渲染 `UserCenterShell`/`UserCenterTabs` + `<Outlet context>`）；`user.$userId._index/articles/badges/fans/followed.tsx` 为子路由，按需加载各 tab 首屏；`shouldRevalidate` 按 `userId` 裁决，`preview_role` 变化时放行（兼容管理员预览视角）。
- **效果**：布局跨 tab 保持挂载；切换时旧内容保留直到新 loader 就绪，内容区无空白；URL/深链/SEO 不变；`meta` 在布局统一按子路径产出分区标题。
- **删除**：`user_.$userId.*`（4 个）、`user-profile-client-page.tsx`（内容视图迁入 `user-center-views.tsx`）。

### 4.8 资料/账号设置内嵌为个人主页 Tab（2026-09-20 新增）

- **目标**：`UserCenterTabs` 追加「资料/账号设置」（仅自己可见），废弃独立的 `/user/profile*` 页面与头像菜单入口。
- **结构**：`user.$userId.profile/account.tsx` 为布局子路由（`RequireUser` + loader 本人校验，非本人回公开页）；旧 `/user/profile*` 改为重定向（兼容书签与站内入口）；布局 `meta` 对资料/账号返回 noindex。
- **删除**：`profile-shell.tsx`、`profile-back-link.tsx`（已无引用）；头像菜单与移动端菜单的「编辑资料」下线，侧边栏编辑资料改为直链嵌套地址。

## 五、开发注意（本仓库约定）

### 5.1 分支工作流（2026-08-08 整理后）

- **本地 `master` = fork 开发主线**，跟踪 `fork/master`，直接 `git push` 推送并触发 GHCR CI。
- **只保留两个分支**：`master`（主线）、`fix/*`（PR 专用，合入后删）。
- 历史遗留分支 `pr297-fix`、`ci-cd` 已删除（内容已并入 master）。
- 同步上游：`git fetch origin && git merge origin/master`（已在 fork 做过一次，git 会自动保留 fork 的 CI/CD 文件）。
- 提 PR 到上游：从 `origin/master` 拉新分支（如 `fix/xxx`）只含业务改动，推送 fork 后 `gh pr create --repo mlogclub/bbs-go --head aishangwuji:<分支>`。

### 5.2 其他开发约定

- 变更后端计数逻辑时注意并发/事务（`sqls.WithTransaction`）。
- 前端尽量用既有组件库，避免引入新库造成认知负担。
- 每次首次连接服务器先读 `/opt/server-architecture.md`；改动服务器服务后必须同步更新该文档。
