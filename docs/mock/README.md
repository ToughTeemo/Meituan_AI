# Provider Mock Data Layer

本目录用于为本地生活出行 / 活动规划 Agent 提供 Provider Mock Data Layer。它不是为了模拟完整真实世界，而是用于支撑：

```text
Planning Agent 生成方案
Execution Agent 执行与重规划
前端方案展示
Provider Contract 联调
未来平滑切换真实 API
```

核心原则：

```text
真实 Provider 能稳定提供的数据，优先来自真实 API。
无法稳定提供的数据，使用 mock / estimated / stub。
任何 mock 数据都不能伪装成实时状态或真实交易结果。
```

## 1. Directory Structure

```text
docs/mock/
├── amap_poi_seed_queries.json
├── pois_amap_raw.json
├── pois_mock.json
├── hours_mock.json
├── price_mock.json
├── queue_mock.json
├── booking_mock.json
├── action_mock.json
└── README.md
```

| 文件 | 对应 Provider | 用途 | 来源 |
| --- | --- | --- | --- |
| `amap_poi_seed_queries.json` | POI Seed | 高德 POI 查询种子 | manual seed |
| `pois_amap_raw.json` | PoiProvider | 高德原始返回，便于排查 | amap |
| `pois_mock.json` | PoiProvider | POI 主表 | amap + manual tags |
| `hours_mock.json` | HoursProvider | 营业时间 | amap / category_estimated_mock |
| `price_mock.json` | PriceProvider | 价格预算 | amap / category_estimated_mock / manual_mock |
| `queue_mock.json` | QueueProvider | 排队与拥挤度估算 | estimated_mock |
| `booking_mock.json` | BookingProvider | 预约 / 购票提示 | stub |
| `action_mock.json` | ActionProvider | 导航 / 分享 / 提醒等动作建议 | local mock |

## 2. Data Relationship

所有 Provider 文件都通过同一个 `poi_id` 关联：

```text
pois_mock.json
  ├── hours_mock.json
  ├── price_mock.json
  ├── queue_mock.json
  ├── booking_mock.json
  └── action_mock.json
```

`pois_mock.json` 是主表。不要随意修改 `poi_id`。新增或删除 POI 后，必须同步重新生成并校验所有 provider mock 文件。

## 3. Current Dataset Summary

```text
POI count: 74
```

POI 类型分布：

```json
{
  "attraction": 21,
  "restaurant": 19,
  "cafe": 8,
  "mall": 9,
  "entertainment": 17
}
```

价格类型分布：

```json
{
  "ticket": 15,
  "free": 22,
  "restaurant_avg": 19,
  "cafe_avg": 8,
  "activity_fee": 10
}
```

预算等级分布：

```json
{
  "low": 35,
  "medium": 21,
  "high": 18
}
```

排队默认等级：

```json
{
  "medium": 42,
  "low": 32
}
```

预约状态：

```json
{
  "pending_user_action": 34,
  "not_required": 39,
  "not_supported": 1
}
```

动作类型：

```json
{
  "navigation": 74,
  "share": 74,
  "reminder": 74,
  "copy_address": 74,
  "booking_hint": 34
}
```

## 4. Source Semantics

### amap

来自高德 API 返回的基础数据或可解析字段。适用于 POI 名称、地址、经纬度、行政区、部分评分、部分价格和部分营业时间。

### category_estimated_mock

基于 POI `type`、`category`、`tags` 的类别估算。用于真实 API 无法稳定提供的营业时间、价格、排队风险等字段。

### manual_mock

人工修正的 mock 规则。例如 Disneytown 作为开放商业街区处理为 `free`，豫园作为低价园林门票处理。

### estimated_mock

仅用于 QueueProvider。它表示基于场所类型和常见客流规律的估算，不是实时排队数据。

### stub

仅用于 BookingProvider。它表示当前系统不具备真实预约、购票、下单能力。BookingProvider 只返回提示，不表示系统已完成预约或交易。

## 5. Provider Files

### 5.1 `pois_mock.json`

POI 主表。关键字段：

```text
poi_id
external_ids.amap_poi_id
name
type
category
district
address
latitude
longitude
tags
suitable_for
recommended_duration_minutes
rating
amap
source
```

`poi_id` 是系统内部稳定 ID，不等于高德 POI ID。`external_ids.amap_poi_id` 用于保留外部来源。

### 5.2 `hours_mock.json`

用于 HoursProvider。关键字段：

```text
hours_label
open_intervals
closed_days
last_entry_time
source
confidence
```

Planning Agent 可用它过滤关门地点；Execution Agent 可用它判断到达时是否仍营业。

### 5.3 `price_mock.json`

用于 PriceProvider。关键字段：

```text
price_type
currency
avg_price
adult_price
child_price
estimated_total_for_family
budget_level
source
confidence
```

主要用于预算过滤、家庭总价估算，以及低 / 中 / 高预算解释。

### 5.4 `queue_mock.json`

用于 QueueProvider。关键字段：

```text
queue_profiles
default_queue_level
default_wait_minutes
reason
source
confidence
```

所有 `source` 必须是 `estimated_mock`。禁止写入 `realtime`、`live`、`当前实时`、`实时` 等会伪装实时数据的文本。

### 5.5 `booking_mock.json`

用于 BookingProvider。关键字段：

```text
booking_required
booking_supported_by_system
status
required_user_action
booking_hint
source
confidence
```

`booking_supported_by_system` 全部为 `false`，`source` 全部为 `stub`。禁止出现 `booked`、`confirmed`、`ordered`、`paid`、`已预约`、`已购票`、`已下单` 等完成态文案。

### 5.6 `action_mock.json`

用于 ActionProvider。动作类型：

```text
navigation
share
reminder
copy_address
booking_hint
```

所有 action 都必须 `requires_user_confirmation=true`。ActionProvider 只提供前端可执行建议，不代表系统已经执行成功。禁止出现 `已导航`、`已分享`、`已提醒`、`自动预约`、`自动下单` 等文案。

## 6. Generation Commands

### 6.1 Generate POI seed from Amap

```powershell
$env:AMAP_WEB_SERVICE_KEY="your_amap_web_service_key"
npm run seed:pois
```

注意：

```text
真实 Key 不要写进代码、文档或 Git。
.env / .env.local 已被 gitignore 忽略。
如果仓库公开，建议重新生成高德 Key。
```

### 6.2 Generate provider mock files

```powershell
npm run mock:hours
npm run mock:price
npm run mock:queue
npm run mock:booking
npm run mock:action
```

### 6.3 Validate all mock files

```powershell
npm run mock:validate
```

### 6.4 Run tests

```powershell
node scripts\seed-amap-pois.test.mjs
node scripts\generate-hours-mock.test.mjs
node scripts\generate-price-mock.test.mjs
node scripts\generate-queue-mock.test.mjs
node scripts\generate-booking-mock.test.mjs
node scripts\generate-action-mock.test.mjs
node scripts\validate-mock-dataset.test.mjs
npm run build
```

## 7. Validation Rules

`npm run mock:validate` 会检查：

```text
所有 JSON 文件可解析
所有 mock 文件都是数组
poi_id 完全对齐
无缺失 / 多余 / 重复 poi_id
POI 主表字段合法
HoursProvider 字段合法，且 closed_days 不与 open_intervals 冲突
PriceProvider 字段合法，餐厅 / 咖啡 / free 规则正确
QueueProvider 不伪装实时数据
BookingProvider 不伪装预约 / 购票 / 下单完成
ActionProvider 全部需要用户确认
无 forbidden words
```

典型 forbidden words：

```text
realtime
live
当前实时
实时
booked
confirmed
ordered
paid
已预约
已购票
已下单
已支付
已导航
已分享
已提醒
自动预约
自动下单
```

## 8. Safe Boundary

### Do

```text
使用高德 POI 作为真实地点种子
使用 estimated_mock 表示排队估算
使用 stub 表示当前系统不支持真实预约 / 下单
使用 manual_mock 表示人工修正
所有 action 都要求用户确认
```

### Do Not

```text
不要伪装实时排队
不要伪装已预约
不要伪装已购票
不要伪装已下单
不要把 API Key 写进仓库
不要随意修改 poi_id
不要跳过 mock:validate
```

## 9. How Backend Should Use This

后端可以基于这些文件实现：

```text
MockDatasetLoader
ProviderCatalog
PlanContextBuilder
PlanningAgent
ExecutionAgent
```

推荐读取关系：

```text
MockDatasetLoader
  ->
load pois_mock.json as POI master table
  ->
join hours / price / queue / booking / action by poi_id
  ->
build PlanContext
```

Planning Agent 可以用 Hours / Price / Queue 做方案过滤和风险提示。Execution Agent 可以用 Hours / Queue / Booking / Action 做执行前校验、提醒和 replan。前端可以用 ActionProvider 渲染导航、分享、提醒、复制地址、预约提示按钮。

## 10. Update Workflow

新增或修改 POI 时：

```text
1. 修改 docs/mock/amap_poi_seed_queries.json
2. 设置 AMAP_WEB_SERVICE_KEY
3. 运行 npm run seed:pois
4. 运行 npm run mock:hours
5. 运行 npm run mock:price
6. 运行 npm run mock:queue
7. 运行 npm run mock:booking
8. 运行 npm run mock:action
9. 运行 npm run mock:validate
10. 运行 npm run build
```

如果只改了某个 provider 的生成规则，也必须重新运行对应生成脚本和 `npm run mock:validate`。
