# BBS-GO Agent 接入技能文档（Agent Access Skill）

> 本文件是给 AI Agent（或任何程序化调用方）使用 bbs-go「Agent 接入」能力的操作指南。
> 配套管理端入口：后台 → 系统 → **Agent 接入**（`/dashboard/agent-tokens`）。

## 1. 前置：获取令牌

- 由管理员在后台「Agent 接入」页面点击 **创建令牌**，填写名称、备注、过期时间。
- 创建成功后令牌明文**只显示一次**，请立即保存；令牌在库中只存 sha256 哈希，服务端无法找回。
- 管理员随后在「能力授权」里为该令牌勾选允许调用的能力（白名单），保存后生效。
- **新上线的管理接口默认不会授权给任何已有令牌**，需要管理员重新在该页面勾选授权。

## 2. 鉴权

所有请求携带请求头：

```
X-agent-token: <令牌明文>
```

- 未携带、令牌错误或已吊销：返回 `errorCode: 1`（未登录）。
- 令牌已过期：同样返回 `errorCode: 1`。

## 3. 入口与能力发现

调用前先请求自描述接口，确认令牌身份与已授权能力：

```
GET /api/agent/me
```

响应（统一信封 `data` 字段）：

```json
{
  "token": { "id": 1, "name": "巡检", "status": 0, "expiredAt": 0, "createTime": 1710000000000 },
  "capabilities": [
    { "method": "POST", "path": "/api/admin/topic/list", "name": "查看话题" },
    { "method": "GET",  "path": "/api/admin/topic/:id",   "name": "查看话题" }
  ]
}
```

`capabilities` 就是当前令牌被授权的能力全集；`name` 为能力的展示名。

## 4. 调用规则

Agent 调用的能力路径与管理端 `/api/admin/**` 一一对应，只是前缀换成 `/api/agent`：

```
POST /api/admin/topic/list   →   POST /api/agent/topic/list
GET  /api/admin/topic/5      →   GET  /api/agent/topic/5
POST /api/admin/user/forbidden  →  POST /api/agent/user/forbidden
```

- 仅「已授权给该令牌」的能力可调用；未授权返回 `errorCode: 2`（无权限）。
- 路径中的 `:id` 使用**明文 ID**（与管理端一致，不使用编码 ID）。

### 参数传递约定

管理端 handler 主要有两种取参方式，Agent 调用时按需选择：

| handler 风格 | 传参方式 | 例子 |
|---|---|---|
| 列表/条件查询（`params.NewPagedSqlCnd` / `NewQueryParams`） | URL query | `/api/agent/topic/list?page=1&limit=20&status=0&title=xxx` |
| 简单字段（`params.FormValue*` / `params.Get*`） | URL query 或 form | `/api/agent/topic/delete?id=5` |
| 结构体绑定（`ginx.Bind`） | JSON body（`Content-Type: application/json`） | 见下 |

query 参数名与前端表单字段名一致（如 `id`、`status`、`type`、`title`、`page`、`limit`）。分页参数默认 `page`、`limit`。

### 统一响应信封

```json
{ "success": true,  "errorCode": 0, "message": "", "data": { ... } }
{ "success": false, "errorCode": 2, "message": "无权限", "data": null }
```

- `success: true`：调用成功，数据在 `data`。
- `success: false`：失败，看 `errorCode` 与 `message`。
- 列表类接口的 `data` 形如 `{ "results": [...], "page": { "page":1, "limit":20, "total":N } }`。

## 5. 安全边界（必须遵守）

- **禁止**尝试访问任何 `/api/agent/agent-token/**` 路径——该组接口（令牌创建/授权/吊销）绝不对 Agent 开放，路由层已硬排除。令牌的创建与授权**只能由管理员在后台操作**。
- **禁止**尝试访问 `/api/admin/**`（前缀）——Agent 只能使用 `/api/agent/**` 网关。
- 未授权即 403（`errorCode: 2`），不要尝试绕过分页/路径参数来扩大查询范围。
- 写操作（POST/DELETE，如删除话题、删除用户、重置密码）一旦调用即生效且不可由 Agent 回滚；执行前先通过查询接口确认对象状态。
- 令牌泄露时请管理员在后台吊销或删除。

## 6. 常见能力路径示例（以实际 `/api/agent/me` 返回为准）

| 能力 | 方法/路径 | 说明 |
|---|---|---|
| 话题列表 | `POST /api/agent/topic/list` | 支持 `status`/`type`/`title` 等过滤 |
| 话题详情 | `GET /api/agent/topic/:id` | |
| 审核话题 | `POST /api/agent/topic/audit` | `id` |
| 删除/恢复话题 | `POST /api/agent/topic/delete` / `undelete` | `id` |
| 推荐话题 | `POST /api/agent/topic/recommend` | `id` |
| 用户列表 | `POST /api/agent/user/list` | 支持 `username`/`status` 等过滤 |
| 用户详情 | `GET /api/agent/user/:id` | |
| 禁言用户 | `POST /api/agent/user/forbidden` | `id` + `forbiddenEndTime` |
| 重置用户密码 | `POST /api/agent/user/reset_password` | 高危，谨慎 |
| 文章列表/审核/删除 | `POST /api/agent/article/list` / `audit` / `delete` | |
| 分类/链接/违禁词 | `POST /api/agent/category/*` / `link/*` / `forbidden-word/*` | |
| 举报处理 | `POST /api/agent/user-report/audit` | |

路径参数以实际能力清单为准；多段路径（如 `/api/agent/forbidden-word/list`）与上面规则一致。

## 7. 最小调用示例（curl）

```bash
# 1. 查看令牌身份与已授权能力
curl -s -H "X-agent-token: <token>" http://<host>/api/agent/me

# 2. 查询待审核话题
curl -s -H "X-agent-token: <token>" \
  "http://<host>/api/agent/topic/list?page=1&limit=10&status=2"

# 3. 审核通过某话题（写操作）
curl -s -X POST -H "X-agent-token: <token>" \
  "http://<host>/api/agent/topic/audit?id=5"
```

## 8. 运维提示

- 每次 Agent 写操作都会写入操作日志（操作人显示为令牌创建人，描述含 `[agent:<令牌名>]`），可在后台「操作日志」追踪。
- 服务端对 Agent 能力按「路由注册表 + 权限注册表」自动发现：新增管理接口并上线后，该能力会自动出现在后台授权列表，但默认不授权给已有令牌。
