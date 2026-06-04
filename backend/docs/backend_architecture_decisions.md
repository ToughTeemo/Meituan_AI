# Backend Architecture Decisions

本文归档当前团队关于后端架构、Provider Layer、Planning Agent、Execution Agent、Mock 数据、前端冻结适配的关键决策。目标是让后续开发在不破坏现有前端契约的前提下，把真实 Provider、Agent 编排和执行闭环逐步接入 service 层。

## 1. 当前总体架构

```text
User Request
        ↓
Planning Agent（方案设计）
        ↓
Provider Layer
        ↓
PlanResponse
        ↓
Execution Agent（执行）
        ↓
Provider Layer（实时刷新）
        ↓
Action / Replan / Reminder
```

核心分工：

- Provider Layer 是统一数据能力层，负责 POI、Route、Weather、Hours、Price、Queue、Booking、Action 等数据和动作能力的统一读取、降级和标注。
- Planning Agent 和 Execution Agent 都会调用 Provider，但调用目的不同。
- Planning Agent 负责生成方案：解析用户请求、选择候选 POI、排序组合路线、生成推荐理由、风险提示和当前前端可消费的 `PlanResponse`。
- Execution Agent 负责执行过程中的刷新、风险检测、替换、重排和动作触发：执行前刷新 Provider Snapshot，识别 unknown / fallback / 用户反馈，必要时触发 replan、action 或 reminder。
- 当前代码中，`PlanningService` 是 `POST /api/plans` 的后端入口，内部按配置选择 POI、Route、Weather Provider，并继续输出现有 `PlanResponse`。

## 2. 前端冻结后的后端适配原则

- 前端已冻结，后端不能破坏当前 API 契约。
- `POST /api/plans` 的 request/response 结构不能随意变更。当前请求仍应兼容 `prompt`、`city`、`timezone`、`session_id`、`user_id`。
- `PlanResponse` / `Card` / `POI` / `Risk` / `Action` 的旧字段必须保留，包括但不限于 `plan_id`、`session_id`、`status`、`version`、`constraints`、`timeline`、`cards`、`active_risk`、`agent_logs`、`summary`、`created_at`、`updated_at`。
- 后端可以新增字段，但不能依赖前端展示新增字段。新增字段必须是向后兼容的 optional 字段。
- `source` / `confidence` / `fallback_reason` 可以先写入 `agent_logs`、`recommendation_reason`、`risk_note`、`risk_labels` 或后端内部上下文，不要求前端立即渲染新字段。
- Execution Agent 先落到现有接口：
  - `risks/scan`
  - `risks/{risk_id}/replan`
  - `actions`
  - `requirements`
- 后端新架构应隐藏在 service 层内部，继续输出当前前端可消费的 `PlanResponse`。也就是说，Provider Layer、PlanContextBuilder、PlanningAgentAdapter、ExecutionAgentAdapter 可以演进，但 API 外壳不能让前端适配两套结构。

## 3. planning_mode 决策

- 先不做前端按钮。
- 前端没有 `planning_mode` 字段，也不应为了模式切换修改 `src/api/plans.ts` 或 `src/types/plan.ts`。
- 当前用后端 `.env` 控制模式。
- 新增或规划配置：
  - `PLANNING_MODE=bounded`
  - `PLANNING_MODE=open`
- `bounded`：稳定模式，只能从 mock / provider catalog 中选择候选 POI。适合 demo、联调和可控回归。
- `open`：探索模式，允许真实 API 搜索新 POI；真实 API 拿不到的字段返回 `unknown`，不能用编造值补齐。
- 不管 `bounded` / `open`，最终输出必须保持同一种 `PlanResponse`。
- 不允许因为模式不同让前端适配两套数据结构。差异只能体现在后端内部候选集、Provider Snapshot、风险提示和 `agent_logs`。

## 4. Provider 数据策略

```text
Real Provider
        ↓
Mock Enrichment
        ↓
Unknown-safe Fallback
```

三层策略：

- 能从真实 API 拿到的数据，不需要 mock。
- 拿不到的字段用 mock / estimated 补充，并标记 `source`、`confidence`、`fallback_reason`。
- mock 也没有时返回 `unknown`，而不是编造确定状态。
- 不允许编造排队、预约、下单、付款、实时状态。
- `unknown` 需要由 Execution Agent 闭环处理：提醒用户确认、保守提示、增加 buffer、触发 replan 或生成待用户确认的 action。

当前 Provider 优先级示例：

- POI / Route / Weather 优先真实 API。当前 POI 和 Route 可走高德，Weather 可走 Open-Meteo；失败时 fallback 到 seed / estimated。
- Hours / Price 可 real + mock + estimated。高德 `open_time`、`biz_ext.cost` 可作为真实或半真实字段，缺失时降级。
- Queue 当前只能 `estimated` 或 `unknown`，不能伪装成 realtime。
- Booking 当前只能 `stub` / `pending_user_action` / `not_supported`，不能返回 confirmed。
- Action 当前可生成 `amap_uri` + share/reminder payload，但所有外部动作都必须先经用户确认。

## 5. Mock 数据边界

- 队友不需要为每个地点准备所有字段。
- `pois_mock.json` 是主表，用来承载标准 POI catalog。当前仓库 `backend/docs/mock` 尚未落地该文件，现阶段稳定 catalog 主要来自 `backend/app/services/poi_service.py` 中的 `SHANGHAI_SEED_PLACES`，以及真实 POI Provider 返回结果。
- 其它 mock 文件通过 `poi_id` 关联。当前已有：
  - `backend/docs/mock/hours_mock.json`
  - `backend/docs/mock/price_mock.json`
  - `backend/docs/mock/queue_mock.json`
  - `backend/docs/mock/booking_mock.json`
  - `backend/docs/mock/action_mock.json`
- Mock 数据分级：
  - required：`poi_id` / `name` / `category` / `tags` / `address` / `lat` / `lng`
  - recommended：`hours` / `price` / `actions`
  - optional：`queue` / `booking`
- 后端需要确保所有 mock 文件的 `poi_id` 能关联成功。跨文件孤儿 `poi_id` 应在启动校验、测试或 MockDatasetLoader 中暴露出来。
- `bounded` 模式下 Planning Agent 只能选择 catalog 中存在的 `poi_id`。
- `open` 模式下 API 查到的新 POI 可以进入方案，但缺失数据必须标记 `unknown`，并由风险提示或 Execution Agent 处理。
- mock 文件只承载样例和降级数据，不代表真实外部状态，尤其不能把 `queue_mock.json` 当实时排队，把 `booking_mock.json` 当真实预约/订单数据。

## 6. Planning Agent 决策约束

- Planning Agent 不能自由编造地点。
- `bounded` 模式：只能从 `ProviderCatalog` / `MockDataset` / 当前 seed catalog 中选择。
- `open` 模式：可以通过真实 API 搜索新 POI，但不能编造不存在的 Provider 结果。
- Planning Agent 可以做排序、组合、解释、权衡、推荐理由生成、风险提示生成。
- Planning Agent 不可以编造：
  - 不存在的 POI
  - 价格
  - 营业状态
  - 已预约
  - 已下单
  - 已付款
  - 实时排队
- 后端必须校验 Agent 输出的 `poi_id` 是否来自候选集或真实 API 搜索结果。校验失败时应丢弃该候选、降级重排或触发安全 fallback，而不是把未知 `poi_id` 透给前端。
- 价格、营业、排队、预约等低置信字段只能影响排序、风险和文案，不能作为确定承诺。

## 7. Execution Agent 闭环

- Execution Agent 只执行 active plan version。
- 执行前刷新 Provider Snapshot，至少覆盖当前卡片及下一步关键卡片相关的 POI、Route、Weather、Hours、Queue、Booking、Action。
- 对 `unknown` 状态需要触发用户确认或保守提示。
- 用户反馈优先级高于 Provider。用户在现场反馈的信息应进入执行状态或 user feedback snapshot，并覆盖 estimated / mock 判断。
- 例子：
  - `queue unknown` -> 提醒用户现场确认。
  - 用户反馈排队 40 分钟 -> 写入 user_feedback snapshot -> 触发 replan。
  - `booking unknown` -> 提醒用户手动确认预约/购票。
- Execution Agent 不能假装：
  - 已预约
  - 已下单
  - 已付款
  - 实时排队真实存在
- 当前阶段 Execution Agent 的外部表现先复用 `requirements`、`risks/scan`、`risks/{risk_id}/replan`、`confirm`、`actions` 等既有接口。

## 8. Plan Session / Versioning 决策

- 网站支持用户多次提需求并修改方案。
- Plan 不是一次性静态结果，而是可迭代的 Plan Session。
- 每次改方案应生成新 version，不覆盖旧 version。
- `active_version` 是当前执行版本。当前 API 已有 `version` 字段和 version snapshot 接口，后续可在内部补充显式 `active_version`。
- 旧版本只读，可用于 compare / restore。
- version 要记录：
  - `session_id`
  - `plan_id`
  - `version`
  - `parent_version`
  - `change_reason`
  - `planning_mode`
- 卡片状态需要支持：
  - `pending`
  - `active`
  - `done`
  - `skipped`
  - `cancelled`
- 兼容说明：当前前端/后端 schema 已支持 `done`、`active`、`pending`、`skipped`，并额外存在 `risk`、`upcoming`、`current`、`adjusted` 等前端状态。`cancelled` 属于后续执行状态规划，加入前必须保持前端兼容。
- `done` 的卡片不能被 Planning Agent 重写，只能作为历史上下文。
- 用户新需求应该被理解为 patch，而不是完全重新开始。RequirementService 应把自然语言变化转成 constraint patch、risk 或 replan trigger，并在新 version 中保留旧版本可追溯性。

## 9. 用户反馈原则

- 用户反馈优先于 Provider。
- 用户反馈应进入执行状态或 provider snapshot，形成可追踪的 `user_feedback` source。
- 典型反馈包括：
  - “这里排队 40 分钟”
  - “餐厅没位”
  - “孩子累了”
  - “预算再省一点”
  - “不要太远”
- `RequirementService` 应把这些自然语言转成约束 patch / risk / replan trigger。
- 当前 `RequirementService` 已能识别部分疲劳、下雨/室内、排队/人多、预算、餐厅没位等文本，但后续需要扩展为结构化 patch，而不是只返回固定文案。
- 用户反馈与 Provider 冲突时，以用户反馈为准；Provider 只作为下一次刷新和验证的输入。

## 10. 当前后端需要优先适配前端的接口

现有前端消费接口和后端路由不能破坏：

- `POST /api/plans`
- `POST /api/plans/{plan_id}/requirements`
- `POST /api/plans/{plan_id}/risks/scan`
- `POST /api/plans/{plan_id}/risks/{risk_id}/replan`
- `POST /api/plans/{plan_id}/confirm`
- `POST /api/plans/{plan_id}/actions`
- plan versions / compare / restore 相关接口：
  - `GET /api/plans/{plan_id}/versions`
  - `GET /api/plans/{plan_id}/versions/compare`
  - `POST /api/plans/{plan_id}/versions/{version_id}/restore`

`action_type` 需要保持前端现有类型：

- `reserve_activity`
- `reserve_restaurant`
- `generate_route`
- `share_plan`
- `set_reminder`

后端内部 `ActionProvider` 可以是 `navigation` / `share` / `reminder`，但输出给前端要映射到现有 `action_type`：

- `navigation` -> `generate_route`
- booking / reservation reminder -> `reserve_activity` 或 `reserve_restaurant`
- `share` -> `share_plan`
- `reminder` -> `set_reminder`

所有对外动作都应带有或隐含 `requires_user_confirmation=true` 的语义。即使当前 `ActionService` 返回 `success`，真实接入时也不能把生成 URI、payload、提醒草稿解释为“已预约/已下单/已付款”。

## 11. 后端实现计划

Step 1：锁定前端 API 契约

- 不破坏 `PlanResponse` / `Card` / `POI` / `Risk` / `Action` 字段。
- 所有新增字段保持 optional，旧前端不展示也不影响主流程。

Step 2：实现 MockDatasetLoader / ProviderCatalog

- 读取 mock 数据。
- 建立 `poi_id` 索引。
- 校验跨文件 `poi_id`。
- 补齐后续 `pois_mock.json` 主表，或把当前 seed catalog 统一导入 ProviderCatalog。

Step 3：实现 `planning_mode`

- `.env` 控制 `bounded` / `open`。
- `bounded` 默认。
- `open` 允许真实 API 搜索并返回 `unknown`。
- 两种模式输出同一种 `PlanResponse`。

Step 4：实现 PlanContextBuilder

- 聚合 POI + Weather + Hours + Price + Queue + Booking + Action。
- 输出 Agent 可消费上下文。
- Provider Snapshot 必须携带 `source`、`confidence`、`fallback_reason`。

Step 5：改造 PlanningAgentAdapter

- 输入 User Request + PlanContext。
- 输出当前前端可消费 `PlanResponse`。
- 校验 `poi_id` 合法性。
- Agent 输出失败或未知 `poi_id` 时触发候选集内重试或 fallback。

Step 6：改造 RequirementService

- 支持预算、餐厅没位、拥堵、少走路、早点吃、孩子累了、排队、人多、下雨等需求。
- 把自然语言转为 constraint patch、risk signal 或 replan trigger。

Step 7：改造 RiskService / Replan

- 支持 weather / queue / budget / time / closure / reservation / fatigue 等风险。
- replan 生成新 version。
- 不覆盖 `done` 卡片。
- 保留 `inserted_card_ids` / `removed_card_ids`，让前端继续播放现有重排动画。

Step 8：改造 ActionService

- 内部接 ActionProvider。
- 输出保持前端 `action_type`。
- 所有外部动作都 `requires_user_confirmation`。
- Booking 相关动作只生成“待用户确认”的跳转、提醒或说明，不返回 confirmed。

Step 9：实现 ExecutionAgentAdapter

- 刷新 Provider。
- 处理 `unknown`。
- 接收用户反馈。
- 触发 replan / action / reminder。
- 只执行 active plan version。

Step 10：补测试

- Planning Agent 不输出未知 `poi_id`。
- `bounded` / `open` 输出同一种 `PlanResponse`。
- `unknown` 不会中断计划。
- Booking 不会返回 `confirmed`。
- Queue 不会伪装 `realtime`。
- `done` 卡片不会被改写。
- 前端接口响应字段不缺失。

## 12. 当前已确认的风险和约束

- `open` 模式 `unknown` 太多会导致方案不够可执行，需要风险提示。
- `bounded` 模式稳定但可选范围取决于 mock 数据质量。
- 美团真实 API 接入后不要替换旧架构，而是在 Real Provider 层新增 `source`。
- 同一地点可能来自 mock / amap / meituan，需要 `canonical_poi_id` 和 `external_ids` 解决统一身份问题。
- 前端冻结后，后端新增字段不能作为唯一展示渠道。
- Provider 结果必须带 `source` / `confidence` / `fallback_reason`，方便 Agent 决策。
- 当前 `PlanResponse` 还没有统一 Provider envelope，短期可把这些信息写入 `agent_logs`、`recommendation_reason`、`risk_note` 或内部上下文。
- Queue 和 Booking 是最容易被误解为真实能力的 Provider，文案和状态必须始终保守。

## 13. 最终原则总结

- Plan 是可版本化的。
- Provider 是可降级的。
- Agent 不编造状态。
- Execution 只执行 active version。
- 用户反馈优先于 Provider。
- `bounded` 保证 demo 稳定。
- `open` 保证未来真实产品扩展。
- `unknown` 不代表失败，而是交给执行闭环处理。

## 14. 第一阶段 Agent 实施策略

当前项目先不实现完整 Autonomous Agent。

第一阶段目标：

- 跑通端到端规划链路。
- 验证 Provider Layer。
- 验证 MockDataset。
- 验证前端交互。

因此，Planning Agent 第一阶段采用 `Rule-based Planner`，而不是 `Full LLM Planner`。

第一阶段流程：

```text
User Request
        ↓
Requirement Parser
        ↓
ProviderCatalog 检索候选 POI
        ↓
PlanContextBuilder
        ↓
Rule-based Planning
        ↓
PlanResponse
```

`Rule-based Planner` 可以负责：

- 筛选候选 POI。
- 排序。
- 预算过滤。
- 营业时间过滤。
- 路线排序。
- 风险提示。

后续第二阶段再替换为 `PlanningAgentAdapter`（LLM 驱动）。

替换原则：

- 前端接口不变。
- `PlanResponse` 不变。
- Provider Layer 不变。
- PlanContextBuilder 不变。
- 只有 Planner 实现发生替换。

## 15. 当前 Catalog 主表策略

当前项目尚未正式落地 `pois_mock.json`。

因此，ProviderCatalog 第一阶段数据来源优先级如下：

1. `SHANGHAI_SEED_PLACES`

   来源：`backend/app/services/poi_service.py`

2. `pois_mock.json`

   后续接入。

3. 真实 POI Provider

   `open` 模式下使用。

ProviderCatalog 对外统一暴露：

- `catalog.search_pois()`
- `catalog.get_poi()`
- `catalog.list_candidates()`

Planning Agent 不允许直接读取：

- mock 文件。
- seed 数据。

Planning Agent 必须统一经过 ProviderCatalog 获取候选数据。

后续 `pois_mock.json` 落地后，无需修改 Planning Agent，只需要替换 Catalog 数据源。

## 16. 默认运行模式决策

当前默认模式：

```env
PLANNING_MODE=bounded
```

原因：

- Demo 稳定。
- 前端冻结。
- Mock 数据可控。
- Provider 可验证。
- Execution Agent 可闭环。

`open` 模式暂时属于实验模式，仅用于：

- Provider 测试。
- 高德真实搜索验证。
- 后续真实产品探索。

默认配置：

```env
PLANNING_MODE=bounded
```

开发阶段要求：

- 所有新增功能必须先在 `bounded` 模式下通过测试。
- 然后再验证 `open` 模式兼容性。

`bounded` 是 MVP 默认路径，`open` 是未来扩展路径。

## 17. 第一阶段开发优先级

P0：

- MockDatasetLoader。
- ProviderCatalog。

P1：

- PlanContextBuilder。

P2：

- PlanningService 重构。
- Rule-based Planner。

P3：

- RequirementService 增强。
- RiskService 增强。

P4：

- ExecutionAgentAdapter。

P5：

- PlanningAgentAdapter（LLM）。

在 P0~P4 完成前：

- 不要开发复杂 Agent Prompt。
- 不要开发 Autonomous Agent。
- 不要开发多 Agent 协作。

先保证：

```text
Provider → Plan → Replan → Action
```

完整跑通。
