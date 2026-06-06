# 当前 API 契约

本文档记录当前已经实现并通过测试的 FastAPI 契约。它优先服务团队协作：前端按这里消费接口，后端改字段前先同步这里。

## 基础约定

- Base URL: `http://localhost:8000/api`
- 内容类型: `application/json`
- 包管理: `uv`
- 后端目录: `backend/`
- 数据存储: SQLite + SQLModel
- 当前数据来源: mock-compatible service 数据，已经通过真实 FastAPI 和 SQLite 持久化流转
- 当前前端降级: 后端不可用时，前端保留 mock fallback，保证演示不断

## 状态流转

```text
IDLE
  -> EXECUTING
  -> RISK_DETECTED
  -> EXECUTING
  -> CONFIRMED
```

前端的 `REPLANNING` 是 UI 动画状态。后端 `replan` 接口直接返回新 `cards` 和新 `version`，前端再播放重新规划动画。

## 核心模型

### PlanResponse

```json
{
  "plan_id": "plan_xxx",
  "status": "EXECUTING",
  "version": 1,
  "constraints": {},
  "timeline": {},
  "cards": [],
  "active_risk": null,
  "agent_logs": [],
  "summary": {
    "title": "周末下午亲子轻松路线",
    "subtitle": "少排队、预算内、20:00 前回家"
  },
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

### RiskSignal

```json
{
  "risk_id": "risk_queue_xxx",
  "type": "queue",
  "severity": "medium",
  "title": "排队变长了",
  "description": "儿童乐园预计等待 55 分钟，可能影响后续晚餐和返程。",
  "affected_card_ids": ["card_park"]
}
```

当前正式支持的风险类型：

- `queue`: 排队变长
- `weather`: 突然下雨/室内偏好
- `fatigue`: 孩子累了

预留但尚未完整实现的风险类型：

- `time`
- `budget`
- `closure`

## 接口清单

### 健康检查

```http
GET /api/health
```

响应：

```json
{
  "ok": true,
  "service": "life-agent-backend",
  "version": "0.1.0"
}
```

### 创建方案

```http
POST /api/plans
```

请求：

```json
{
  "prompt": "今天下午带孩子出去玩，不想太累，预算500，晚上8点前回家",
  "city": "北京",
  "timezone": "Asia/Shanghai"
}
```

响应：`201 Created`，返回 `PlanResponse`。

前端用途：

- 首页点击“帮我安排”
- 规划页生成完成后进入 Dashboard

### 获取方案

```http
GET /api/plans/{plan_id}
```

响应：`200 OK`，返回最新 `PlanResponse`。

前端用途：

- 刷新恢复
- 团队后续做多端同步时作为状态拉取入口

### 扫描风险

```http
POST /api/plans/{plan_id}/risks/scan
```

请求：

```json
{
  "risk_types": ["queue"]
}
```

也可以传：

```json
{
  "risk_types": ["weather"]
}
```

或：

```json
{
  "risk_types": ["fatigue"]
}
```

响应：

```json
{
  "plan_id": "plan_xxx",
  "status": "RISK_DETECTED",
  "risks": [],
  "agent_logs": []
}
```

行为约定：

- 命中风险时，后端会保存 `active_risk`。
- 命中风险时，后端会把受影响卡片标记为 `risk`。
- 当前前端手动按钮“排队变长 / 突然下雨 / 孩子累了”都会优先调用此接口。

### Current Frontend Replan Chain

`scanRisks()` and `replanRisk()` are frontend wrapper names. They no longer map
1:1 to the legacy `/risks/scan` and `/risks/{risk_id}/replan` backend routes.

```http
POST /api/plans/{plan_id}/execution/check
GET  /api/plans/{plan_id}/execution/latest
GET  /api/plans/{plan_id}/replan/latest
GET  /api/plans/{plan_id}/replans
POST /api/plans/{plan_id}/replan/{proposal_id}/apply
```

Frontend wrapper-visible fields:

- `risk_type`
- `proposal.proposal_summary`
- `proposal.reason`

If no proposal is available, the wrapper falls back to `execution.summary` for
the visible description.

The proposal wrapper response includes:

- `proposal_id`
- `status`
- `strategy`
- `risk_type`
- `accepted`
- `proposal`
- `updated_plan`

### 忽略风险

```http
POST /api/plans/{plan_id}/risks/{risk_id}/ignore
```

响应：

```json
{
  "plan_id": "plan_xxx",
  "status": "EXECUTING",
  "agent_logs": []
}
```

前端用途：

- Dashboard 风险条点击“暂不调整”

### 接受风险并重新规划

```http
POST /api/plans/{plan_id}/risks/{risk_id}/replan
```

请求：

```json
{
  "strategy": "balanced",
  "user_note": "尽量别影响晚餐和返程",
  "base_version": 1
}
```

响应：

```json
{
  "plan_id": "plan_xxx",
  "status": "EXECUTING",
  "version": 2,
  "cards": [],
  "inserted_card_ids": ["card_indoor_rest"],
  "removed_card_ids": ["card_park"],
  "agent_message": "已缩短高排队活动，并插入低等待替代方案。晚餐与返程保持稳定。",
  "agent_logs": []
}
```

行为约定：

- `version` 每次成功 replan 后递增。
- `queue`、`weather`、`fatigue` 都已经支持重新规划。
- 后端返回新 `cards`，前端负责播放 replan 动画。

### 提交补充需求

```http
POST /api/plans/{plan_id}/requirements
```

请求：

```json
{
  "text": "孩子有点累了，想找个室内休息点",
  "source": "user_input"
}
```

`source` 可选值：

- `user_input`
- `quick_chip`
- `voice`

响应：

```json
{
  "plan_id": "plan_xxx",
  "requires_replan": true,
  "risk": {
    "risk_id": "risk_fatigue_xxx",
    "type": "fatigue",
    "severity": "medium",
    "title": "孩子有点累了",
    "description": "建议加入低等待室内休息点，让后半程更轻松。",
    "affected_card_ids": ["card_park"]
  },
  "agent_logs": [],
  "message": "建议加入低等待室内休息点，让后半程更轻松。"
}
```

行为约定：

- 用户输入含“累”会触发 `fatigue`。
- 用户输入含“下雨 / 雨 / 室内”会触发 `weather`。
- 用户输入含“排队 / 人多”会触发 `queue`。
- 不需要 replan 的文本会返回 `requires_replan: false` 和普通 `message`。
- 聊天框快捷词只填入输入框，点击“发送”后才调用此接口。

### 确认方案

```http
POST /api/plans/{plan_id}/confirm
```

请求：

```json
{
  "confirmed_by": "current_user"
}
```

响应：

```json
{
  "plan_id": "plan_xxx",
  "status": "CONFIRMED",
  "next_actions": [
    {
      "action_id": "reserve_activity",
      "label": "预约亲子乐园",
      "enabled": true
    }
  ],
  "agent_logs": []
}
```

### 执行确认页动作

```http
POST /api/plans/{plan_id}/actions
```

请求：

```json
{
  "action_type": "reserve_restaurant",
  "card_id": "card_dinner",
  "payload": {}
}
```

`action_type` 可选值：

- `reserve_activity`
- `reserve_restaurant`
- `generate_route`
- `share_plan`
- `set_reminder`

响应：

```json
{
  "action_id": "act_xxx",
  "action_type": "reserve_restaurant",
  "status": "success",
  "message": "已开始尝试预约餐厅，当前为演示结果。",
  "agent_logs": []
}
```

## 错误格式

统一错误响应：

```json
{
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "Plan does not exist or has expired.",
    "details": {}
  }
}
```

当前常见错误：

- `PLAN_NOT_FOUND`: 方案不存在
- `RISK_NOT_FOUND`: 风险不存在或已经不再活跃
- `REPLAN_NOT_AVAILABLE`: 预留错误，当前三类核心风险已可 replan

## 本地验证命令

PowerShell:

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run ruff check .
uv run pytest
```

前端：

```powershell
cd E:\Meituan_AI
npm run build
```

