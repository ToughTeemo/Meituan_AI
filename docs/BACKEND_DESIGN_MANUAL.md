# 后端设计手册：FastAPI 接入方案

## 1. 目标与边界

本手册用于指导团队把当前纯前端 Demo 升级为 FastAPI 驱动的本地生活 AI Agent 后端。目标是让前端现有的“输入需求 -> 生成计划 -> 风险检测 -> 接受建议 -> 重新规划 -> 确认执行”主链路能够接入真实 API，同时保留前端已有状态机与动画体验。

当前前端核心数据结构位于 `src/types/plan.ts`，后端第一阶段应尽量与这些字段对齐，避免前端大面积重构。

### 后端负责

- 解析自然语言需求，生成结构化约束。
- 生成初始计划，包括时间轴卡片、POI、替代方案和摘要。
- 检测风险，包括排队、天气、闭店、预算、时间延误、疲劳等。
- 根据风险和补充需求重新规划。
- 管理计划状态、历史版本、用户决策和执行动作。
- 提供日志、进度和实时事件推送。

### 前端继续负责

- 页面布局、动画、状态机 UI 表达。
- Replan 动画生命周期，例如 freezing、generating、animating。
- 卡片点击、焦点联动、地图示意展示。
- API loading、error、retry 等交互反馈。

---

## 2. 推荐目录结构

建议后端新增为独立目录，便于前后端团队并行开发。

```text
backend/
  app/
    main.py
    core/
      config.py
      errors.py
      logging.py
    api/
      routes/
        health.py
        plans.py
        risks.py
        actions.py
        events.py
    schemas/
      common.py
      plan.py
      risk.py
      action.py
      event.py
    services/
      planning_service.py
      requirement_service.py
      risk_service.py
      replan_service.py
      action_service.py
      poi_service.py
      route_service.py
    repositories/
      plan_repository.py
    integrations/
      llm_client.py
      map_client.py
      weather_client.py
      meituan_client.py
    tests/
      test_plans.py
      test_risks.py
      test_replan.py
  pyproject.toml
  README.md
```

### 模块职责

- `api/routes/`：只处理 HTTP 入参、鉴权、状态码和返回。
- `schemas/`：Pydantic 请求与响应模型，是前后端协作契约。
- `services/`：业务编排，例如生成计划、扫描风险、重排。
- `repositories/`：计划、风险、日志、历史版本的存储读写。
- `integrations/`：外部服务封装，避免业务层直接调用第三方 API。
- `core/`：配置、错误、日志、全局中间件。

---

## 3. 核心数据模型

后端响应应优先兼容前端已有结构。

### Plan

```json
{
  "plan_id": "plan_123",
  "status": "EXECUTING",
  "constraints": {},
  "timeline": {},
  "cards": [],
  "active_risk": null,
  "agent_logs": [],
  "summary": {
    "title": "周末下午亲子轻松路线",
    "subtitle": "少排队、预算内、20:00 前回家"
  },
  "version": 1,
  "created_at": "2026-05-13T10:00:00+08:00",
  "updated_at": "2026-05-13T10:00:00+08:00"
}
```

### Constraints

字段应与前端 `Constraints` 保持兼容：

```json
{
  "goal": "今天下午带孩子出去玩",
  "time_start": "14:00",
  "time_end": "20:00",
  "adults": 2,
  "children": 1,
  "children_age": 5,
  "budget": 500,
  "departure": "芍药居",
  "transport_mode": "地铁",
  "pace": "轻松",
  "preference_tags": ["亲子", "少排队", "预算内"]
}
```

### Card

```json
{
  "card_id": "card_001",
  "type": "activity",
  "status": "active",
  "label": "朝阳公园 · 轻松游玩",
  "emoji": "🎡",
  "start_minute": 20,
  "duration_minutes": 90,
  "is_flexible": true,
  "is_new": false,
  "poi": {},
  "risk_note": null,
  "alternatives": []
}
```

### POI

```json
{
  "poi_id": "poi_001",
  "name": "朝阳公园",
  "rating": 4.7,
  "price_per_person": 10,
  "queue_minutes": 25,
  "category": "亲子活动",
  "map_position": { "x": 38, "y": 28 },
  "is_child_friendly": true,
  "hours_label": "06:00-22:00"
}
```

### RiskSignal

```json
{
  "risk_id": "risk_queue_001",
  "type": "queue",
  "severity": "medium",
  "title": "排队变长了",
  "description": "儿童乐园预计等待 55 分钟，可能影响晚餐和返程。",
  "affected_card_ids": ["card_002"]
}
```

---

## 4. API 契约

所有接口统一返回 JSON。建议路径统一加 `/api` 前缀。

### 4.1 健康检查

```text
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

### 4.2 创建计划

```text
POST /api/plans
```

请求：

```json
{
  "prompt": "今天下午带孩子出去玩，不想太累，预算500，最好少排队，晚上8点前回家",
  "context": {
    "city": "北京",
    "timezone": "Asia/Shanghai"
  }
}
```

响应：

```json
{
  "plan_id": "plan_123",
  "constraints": {},
  "timeline": {},
  "cards": [],
  "agent_logs": [
    {
      "id": "log_001",
      "created_at": 1715580000000,
      "message": "方案已生成，正在关注排队、天气和预算变化。"
    }
  ]
}
```

### 4.3 获取计划

```text
GET /api/plans/{plan_id}
```

用于刷新页面、恢复状态、多人协同时重新拉取最新计划。

### 4.4 提交补充需求

```text
POST /api/plans/{plan_id}/requirements
```

请求：

```json
{
  "text": "孩子有点累了，想找个室内休息点",
  "source": "user_input"
}
```

响应：

```json
{
  "plan_id": "plan_123",
  "requires_replan": true,
  "risk": {
    "risk_id": "risk_fatigue_001",
    "type": "fatigue",
    "severity": "medium",
    "title": "孩子有点累了",
    "description": "建议加入低等待室内休息点。",
    "affected_card_ids": ["card_002"]
  },
  "agent_logs": []
}
```

### 4.5 扫描风险

```text
POST /api/plans/{plan_id}/risks/scan
```

请求：

```json
{
  "risk_types": ["queue", "weather", "closure", "budget", "time", "fatigue"]
}
```

响应：

```json
{
  "risks": [],
  "agent_logs": []
}
```

### 4.6 忽略风险

```text
POST /api/plans/{plan_id}/risks/{risk_id}/ignore
```

响应：

```json
{
  "plan_id": "plan_123",
  "status": "EXECUTING",
  "agent_logs": [
    {
      "id": "log_002",
      "created_at": 1715580001000,
      "message": "已暂不调整，继续按当前安排推进。"
    }
  ]
}
```

### 4.7 接受建议并重新规划

```text
POST /api/plans/{plan_id}/risks/{risk_id}/replan
```

请求：

```json
{
  "strategy": "balanced",
  "user_note": "尽量别影响晚餐和返程"
}
```

响应：

```json
{
  "plan_id": "plan_123",
  "version": 2,
  "cards": [],
  "inserted_card_ids": ["card_new_001"],
  "removed_card_ids": ["card_002"],
  "agent_message": "已缩短高排队活动，并插入低等待替代方案。",
  "agent_logs": []
}
```

前端拿到 `cards` 后，继续调用现有 Replan 动画流程。

### 4.8 确认方案

```text
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
  "plan_id": "plan_123",
  "status": "CONFIRMED",
  "next_actions": [
    {
      "action_id": "reserve_dinner",
      "label": "预约晚餐",
      "enabled": true
    }
  ]
}
```

### 4.9 执行动作

```text
POST /api/plans/{plan_id}/actions
```

请求：

```json
{
  "action_type": "reserve_restaurant",
  "card_id": "card_004",
  "payload": {
    "party_size": 3,
    "time": "18:00"
  }
}
```

响应：

```json
{
  "action_id": "act_001",
  "status": "pending",
  "message": "已开始尝试预约餐厅。"
}
```

### 4.10 实时事件

第一阶段可以不做。第二阶段建议使用 SSE 或 WebSocket。

```text
GET /api/plans/{plan_id}/events
```

事件类型建议：

```text
plan.created
plan.updated
risk.detected
risk.ignored
replan.started
replan.completed
action.started
action.completed
agent.log
```

---

## 5. 状态机约定

前端已有状态：

```text
IDLE -> EXECUTING -> RISK_DETECTED -> REPLANNING -> EXECUTING
```

后端建议增加持久化状态，但不要强行让前端 UI 状态完全等同数据库状态。

### 后端 PlanStatus

```text
DRAFT
PLANNING
EXECUTING
RISK_DETECTED
REPLANNING
CONFIRMED
COMPLETED
CANCELLED
FAILED
```

### 协作规则

- 后端返回 `status`，前端可以映射到自己的 `MachineState`。
- Replan 动画阶段仍由前端控制，后端不需要知道 `freezing/generating/animating`。
- 每次重排必须递增 `version`，便于并发控制和回滚。
- 修改计划类接口建议带 `base_version`，避免多人或多标签页覆盖。

---

## 6. 错误格式

统一错误响应：

```json
{
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "计划不存在或已过期",
    "details": {}
  }
}
```

常用错误码：

```text
INVALID_REQUEST
PLAN_NOT_FOUND
PLAN_VERSION_CONFLICT
RISK_NOT_FOUND
REPLAN_NOT_AVAILABLE
EXTERNAL_SERVICE_TIMEOUT
LLM_GENERATION_FAILED
ACTION_NOT_SUPPORTED
RATE_LIMITED
INTERNAL_ERROR
```

前端展示原则：

- 用户可修复的问题展示明确提示，例如“这个方案已更新，请刷新后再试”。
- 外部服务失败可以降级为“暂时无法获取实时排队，先使用估算数据”。
- LLM 失败不要暴露底层报错，返回可理解的兜底文案。

---

## 7. 团队协作规范

### API 契约优先

每个接口开发前先更新：

- OpenAPI schema
- 请求响应示例
- 字段说明
- 错误码

前后端以 schema 为准，不以口头约定为准。

### 分支建议

```text
feature/backend-scaffold
feature/api-plan-create
feature/api-risk-replan
feature/frontend-api-adapter
feature/realtime-events
```

### Pull Request 要求

每个 PR 至少说明：

- 改了哪些接口或模型。
- 是否影响前端字段。
- 是否需要迁移数据。
- 如何本地验证。
- 是否更新文档和测试。

### 命名约定

- Python 文件、变量和函数使用 `snake_case`。
- API JSON 字段使用 `snake_case`，与当前前端类型一致。
- ID 前缀建议统一：`plan_`、`card_`、`poi_`、`risk_`、`log_`、`act_`。
- 时间字段使用 ISO 8601；前端现有 `created_at: number` 的日志字段可暂时保留毫秒时间戳。

### Mock 与真实实现隔离

第一阶段允许后端返回 mock，但必须经过 service 层：

```text
route -> service -> repository/integration
```

不要在 route 里直接写大段 mock 数据，否则后续接真实服务会很痛。

---

## 8. 分阶段落地计划

### Phase 1：后端骨架与契约

- 建立 FastAPI 项目。
- 实现 `GET /api/health`。
- 定义 Pydantic schema。
- 实现 `POST /api/plans`，返回与当前前端 mock 等价的数据。
- 生成 OpenAPI 文档，前端开始按接口写 adapter。

验收标准：

- 后端可启动。
- `/docs` 能看到接口。
- `POST /api/plans` 返回 `constraints/cards/timeline`。

### Phase 2：前端接入初始计划

- 新增前端 API client。
- `PlanningPage` 调用 `POST /api/plans`。
- `PlanProvider` 支持从 API 初始化计划。
- 保留 mock fallback，便于演示兜底。

验收标准：

- 首页输入 prompt 后，方案来自后端响应。
- 后端挂掉时，前端有明确错误或 fallback。

### Phase 3：风险与 Replan

- 实现 `/risks/scan`、`/ignore`、`/replan`。
- 前端把 `triggerDemoRisk` 和 `acceptRiskSuggestion` 改为调用 API。
- 后端返回 `risk` 和 `nextCards`，前端继续播放原有动画。

验收标准：

- 手动触发排队风险后，后端返回 `RiskSignal`。
- 点击接受建议后，前端使用后端 `cards` 完成 Replan 动画。

### Phase 4：补充需求与确认执行

- 实现 `/requirements`。
- 实现 `/confirm`。
- 实现 `/actions` 的 mock 版本。
- 前端接入“预约晚餐、查看路线、设置提醒”等动作。

验收标准：

- 输入“孩子累了”能触发 fatigue 风险或直接返回建议。
- 确认方案后能进入确认态，并返回下一步动作。

### Phase 5：实时事件与外部能力

- 接入 SSE 或 WebSocket。
- 接入真实天气、地图、POI、排队、预约等服务。
- 增加后台任务和重试机制。

验收标准：

- 后端可主动推送风险。
- 外部服务失败时能降级，不破坏主流程。

---

## 9. 测试策略

### 单元测试

- 需求解析：不同 prompt 能生成合理 constraints。
- 计划生成：卡片时间不重叠，预算不明显超限。
- 风险检测：不同风险类型能命中正确卡片。
- Replan：新方案保留关键约束，例如晚餐和返程时间。

### API 测试

- 每个接口覆盖成功响应。
- 每个接口覆盖至少一个错误响应。
- `plan_id` 不存在时返回 `PLAN_NOT_FOUND`。
- `base_version` 过期时返回 `PLAN_VERSION_CONFLICT`。

### 契约测试

- 后端响应必须能被前端 TypeScript 类型消费。
- 字段新增必须向后兼容。
- 字段删除或改名必须提前同步并分阶段迁移。

---

## 10. 前后端对接清单

每次新增或修改接口时，团队按这个清单过一遍：

- 接口路径是否稳定。
- 请求体是否有示例。
- 响应体是否有示例。
- 错误码是否明确。
- 是否影响 `src/types/plan.ts`。
- 前端是否需要 loading 状态。
- 前端是否需要 retry。
- 是否需要 mock fallback。
- 是否需要实时事件。
- 是否需要存储计划历史。

---

## 11. 第一版优先级建议

最先实现这三个接口：

```text
GET  /api/health
POST /api/plans
POST /api/plans/{plan_id}/risks/{risk_id}/replan
```

原因：

- `POST /api/plans` 打通“输入需求 -> 生成方案”。
- `POST /replan` 打通 Demo 最核心的“风险 -> 重新规划”。
- 其他能力可以先用 mock 或日志兜底，不阻塞主链路。

等这条主链路稳定后，再补 `/requirements`、`/confirm`、`/actions` 和实时事件。
