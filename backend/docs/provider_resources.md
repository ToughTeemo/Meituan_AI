# Provider Resources 外部数据资源层

本文档整理当前 FastAPI + React 项目的外部数据资源层，供方案设计 Agent 和执行 Agent 使用。当前业务代码只实际接入了 POI、路线、天气三类服务，其余 Provider 已在配置层预留开关，本文按“当前实现 + 推荐演进”描述。

> 说明：现有 `PlanResponse`、`POI`、`RouteLeg`、`WeatherSnapshot` 还没有统一的 `source` / `confidence` 字段。本文的 confidence 规则是 Provider 层建议，短期可写入 Agent 内部上下文或 `agent_logs`，后续建议沉淀为统一响应 envelope。

## 状态总览

| Provider | 当前状态 | 配置项 | 当前实现或计划实现位置 | 说明 |
| --- | --- | --- | --- | --- |
| `PoiProvider` | `hybrid` | `POI_PROVIDER`，默认 `seed`，推荐 `amap` | 已实现：`backend/app/services/poi_service.py`；接线：`backend/app/services/planning_service.py` | 高德 Place Search 可用，失败时 fallback 到上海 seed POI。 |
| `RouteProvider` | `hybrid` | `ROUTE_PROVIDER`，默认 `estimated`，推荐 `amap` | 已实现：`backend/app/services/route_service.py`；接线：`backend/app/services/planning_service.py` | 高德 driving / walking 可用；地铁和未知模式 fallback 到估算路线。 |
| `WeatherProvider` | `hybrid` | `WEATHER_PROVIDER`，默认 `seed`，推荐 `open_meteo` | 已实现：`backend/app/services/weather_service.py`；接线：`backend/app/services/planning_service.py` | Open-Meteo 可用，异常时 fallback 到 seed 天气。 |
| `HoursProvider` | `hybrid` | `HOURS_PROVIDER`，默认 `hybrid` | 计划实现：独立 `hours_service.py` 或先作为 `poi_service.py` enrichment | 优先高德 POI `open_time` / `biz_ext.open_time`，没有则按类目估算。 |
| `PriceProvider` | `hybrid`（`amap_cost` + `estimated`） | `PRICE_PROVIDER`，默认 `estimated` | 部分已嵌入：`AmapPoiService._place_from_amap_item()` 读取 `biz_ext.cost`；计划抽出独立 Provider | 优先高德 `biz_ext.cost`，没有则 seed / 类目估算。 |
| `QueueProvider` | `estimated` | `QUEUE_PROVIDER`，默认 `estimated` | 当前嵌入 POI：seed `queue_minutes`，高德结果固定估算；计划实现独立 `queue_service.py` | 暂无稳定公开真实 API，必须按估算和用户反馈处理。 |
| `BookingProvider` | `stub` | `BOOKING_PROVIDER`，默认 `stub` | 计划实现：`booking_service.py` | 当前没有美团合作 API 权限，只能输出“需用户手动预订”的执行建议。 |
| `ActionProvider` | `hybrid`（`amap_uri` + payload） | `ACTION_PROVIDER`，默认 `amap_uri` | 计划实现：`action_service.py`，前端执行入口可消费 payload | 可真实生成高德导航 URI；分享、提醒先输出 payload，由前端或执行 Agent 触发用户确认。 |

## 通用输入输出约定

| 类型 | 当前字段 |
| --- | --- |
| 用户请求 | `CreatePlanRequest`: `prompt`、`city`、`timezone`、`session_id`、`user_id`。 |
| 约束输入 | `Constraints`: `goal`、`time_start`、`time_end`、`adults`、`children`、`children_age`、`budget`、`departure`、`transport_mode`、`pace`、`preference_tags`。 |
| POI 内部模型 | `ShanghaiPlace`: `place_id`、`name`、`district`、`address`、`category`、`latitude`、`longitude`、`rating`、`price_per_person`、`queue_minutes`、`hours_label`、`map_x`、`map_y`、`tags`、`is_child_friendly`、`is_indoor`、`recommendation_reason`。 |
| 前端 POI 输出 | `POI`: `poi_id`、`name`、`rating`、`price_per_person`、`queue_minutes`、`category`、`map_position`、`is_child_friendly`、`hours_label`、`address`、`district`、`latitude`、`longitude`、`recommendation_reason`、`risk_labels`。 |
| 路线输出 | `RouteLeg`: `distance_km`、`duration_minutes`、`mode`、`summary`。 |
| 天气输出 | `WeatherSnapshot`: `condition`、`temperature_c`、`rain_probability`、`summary`，并通过 `prefers_indoor` 推导室内优先。 |

## PoiProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`。当 `POI_PROVIDER=amap` 且 `AMAP_API_KEY` 有效时走真实高德；否则或异常时走 seed。 |
| 当前实现或计划实现位置 | `backend/app/services/poi_service.py`: `PoiService` protocol、`AmapPoiService`、`ShanghaiSeedPoiService`。`backend/app/services/planning_service.py` 根据 `settings.poi_provider` 接线。 |
| 真实数据源 | 高德开放平台 Place Search：`https://restapi.amap.com/v3/place/text`，当前参数包括 `key`、`keywords`、`city=上海`、`offset`、`page=1`、`extensions=all`。当前读取 `id`、`name`、`location`、`type`、`adname`、`address`、`biz_ext.rating`、`biz_ext.cost`。 |
| fallback/mock 数据源 | `SHANGHAI_SEED_PLACES`，由 `ShanghaiSeedPoiService` 按 `Constraints.goal` 和 `preference_tags` 生成 tags 后排序。 |
| 输入字段 | `Constraints` 全量字段，当前重点使用 `goal`、`preference_tags`、`budget`。高德查询还隐含固定城市 `上海` 和 `limit`。 |
| 输出字段 | `ShanghaiPlace` 全量字段，后续转换为前端 `POI` 字段。高德结果会过滤上海经纬度范围，并映射 `rating`、`price_per_person`、`category`、`district`、`address`、`tags`、`is_child_friendly`、`is_indoor`。 |
| confidence 规则 | `0.85`: 高德返回有效 `id`、`location`，且落在上海范围内。`0.75`: 高德 POI 有坐标但评分/价格缺失，使用默认值补齐。`0.60`: 使用 `SHANGHAI_SEED_PLACES`。`0.45`: 关键词过宽或只命中默认休闲类目。 |
| 限制和风险 | 高德 POI 覆盖、评分、价格不等于实时可用性；`biz_ext.cost` 语义可能随类目变化；当前 keyword 映射较粗；坐标为高德体系，跨地图时需注意坐标系；seed 数据适合 demo，不适合承诺营业、票价、排队真实性。 |
| 给方案设计 Agent 的使用建议 | 优先用高 confidence POI 作为主线节点；低 confidence POI 只做备选或轻量推荐。不要仅凭 POI Provider 判断是否营业、是否可订、是否低排队，应叠加 Hours / Queue / Booking。预算敏感时把 `price_per_person` 当估算值，并保留 20% 以上余量。 |
| 给执行 Agent 的使用建议 | 执行前按 `poi_id`、名称、坐标重新刷新 POI；若刷新失败但用户已接近目的地，可保留原计划并提示数据来源为 fallback。导航动作必须使用经纬度和名称一起生成，避免同名 POI。 |

## RouteProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`。当 `ROUTE_PROVIDER=amap` 且交通模式为 driving / walking 对应值时走高德；地铁和未知模式 fallback 到估算。 |
| 当前实现或计划实现位置 | `backend/app/services/route_service.py`: `RouteService` protocol、`AmapRouteService`、`EstimatedShanghaiRouteService`。`backend/app/services/planning_service.py` 根据 `settings.route_provider` 接线。 |
| 真实数据源 | 高德路径规划：`/v3/direction/driving`、`/v3/direction/walking`，当前参数包括 `key`、`origin`、`destination`、`extensions=base`。 |
| fallback/mock 数据源 | `EstimatedShanghaiRouteService` 使用经纬度球面距离估算：驾车约 22 km/h 加 8 分钟，步行约 4.5 km/h，其他模式约 18 km/h 加 10 分钟。 |
| 输入字段 | `origin: ShanghaiPlace`、`destination: ShanghaiPlace`、`Constraints.transport_mode`。要求 origin/destination 有 `latitude`、`longitude`。 |
| 输出字段 | `RouteLeg`: `distance_km`、`duration_minutes`、`mode`、`summary`。 |
| confidence 规则 | `0.85`: 高德 driving / walking 返回有效距离和耗时。`0.55`: fallback 估算路线。`0.50`: 用户选择地铁但当前未接入高德公交/地铁接口，只能用距离估算。`0.35`: 缺少坐标或坐标可信度低时的临时估算。 |
| 限制和风险 | 当前没有真实地铁/公交换乘；高德接口使用 `extensions=base`，不包含完整步骤和拥堵细节；估算路线不考虑过江、换乘、进出站、等车、安检、商场内部步行；距离和耗时不能作为准点承诺。 |
| 给方案设计 Agent 的使用建议 | driving / walking 可用于排序和卡片耗时；地铁模式必须自动增加缓冲，不要做分钟级精确承诺。低 confidence route 应降低紧凑行程权重，并增加可跳过卡片或替代点。 |
| 给执行 Agent 的使用建议 | 每段出发前重新计算路线；若返回 fallback，提醒用户“按估算时间执行”。遇到用户迟到、天气变化、排队超时，应基于最新 `duration_minutes` 触发 replanning。 |

## WeatherProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`。当 `WEATHER_PROVIDER=open_meteo` 时走 Open-Meteo；请求异常时 fallback 到 seed。 |
| 当前实现或计划实现位置 | `backend/app/services/weather_service.py`: `WeatherService` protocol、`OpenMeteoWeatherService`、`SeedWeatherService`。`backend/app/services/planning_service.py` 根据 `settings.weather_provider` 接线。 |
| 真实数据源 | Open-Meteo Forecast API：`https://api.open-meteo.com/v1/forecast`，当前固定上海坐标 `31.2304,121.4737`，读取 `current=temperature_2m,precipitation,rain` 和 `forecast_days=1`。 |
| fallback/mock 数据源 | `SeedWeatherService` 固定返回 cloudy、24 摄氏度、20% 降雨概率和上海周末出行摘要。 |
| 输入字段 | 当前无外部输入，固定查询上海当前天气。后续可接入 `city`、`timezone`、计划日期、计划时间段和区县坐标。 |
| 输出字段 | `WeatherSnapshot`: `condition`、`temperature_c`、`rain_probability`、`summary`；`prefers_indoor` 当 `rain_probability >= 45` 或 `condition in {"rain", "storm"}` 时为真。 |
| confidence 规则 | `0.85`: Open-Meteo 当前天气请求成功且字段可解析。`0.65`: Open-Meteo 成功但只有部分字段，使用默认温度/降雨补齐。`0.55`: seed 天气。`0.40`: 天气数据超过计划执行窗口或城市不匹配。 |
| 限制和风险 | 当前只查上海单点当前天气，不是逐小时预报；`rain_probability` 目前由是否有 rain/precipitation 简化推导，不是严格降雨概率；不能反映区县微气候、体感、风力、高温预警。 |
| 给方案设计 Agent 的使用建议 | `prefers_indoor=true` 时提高室内 POI 和地铁便利 POI 权重；天气 confidence 低时不要把户外活动作为唯一主线，至少提供室内备选。 |
| 给执行 Agent 的使用建议 | 会话开始、每个大卡片结束、用户要求调整时刷新天气。若从无雨变有雨，应优先替换户外活动并追加天气风险标签。 |

## HoursProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`，设计态；尚未独立接入业务流程。当前只有 `ShanghaiPlace.hours_label` 被带到前端，seed 有人工 hours，高德 POI 当前仅给固定兜底文案。 |
| 是否有真实 API | 有可用真实字段，但不是独立 Hours API。优先使用高德 POI `open_time` / `biz_ext.open_time`；字段缺失时不能认为真实营业时间已知。 |
| 当前推荐数据来源 | 高德 POI 原始字段 `open_time`、`biz_ext.open_time`，必要时保留原始字符串；短期可先在 `poi_service.py` enrichment，稳定后抽为 `backend/app/services/hours_service.py`。 |
| mock / fallback 数据来源 | seed `hours_label`；类目估算：博物馆/展馆约 `09:00-17:00` 或 `10:00-18:00`，商场/街区约 `10:00-22:00`，餐饮按午晚餐时段，公园约 `05:00-21:00`。 |
| 推荐输入字段 | `poi_id`、`name`、`category`、`address`、`latitude`、`longitude`、`planned_arrival_at`、`planned_duration_minutes`、`timezone`、`open_time`、`biz_ext.open_time`、`source_poi_provider`。 |
| 推荐输出字段 | `hours_label`、`is_open_at_arrival`、`open_intervals`、`next_open_time`、`next_close_time`、`source`、`confidence`、`fallback_reason`、`risk_note`。当前前端只消费 `hours_label` 和 `risk_labels`。 |
| confidence 规则 | `0.80`: 高德返回可解析营业时间且覆盖计划到达时间。`0.65`: 高德返回营业文案但不可完全结构化，只展示 label。`0.55`: seed `hours_label`。`0.45`: 类目估算。`0.30`: 未知或仅写“以商户实时信息为准”。 |
| 限制和风险 | 营业时间经常受节假日、临时闭馆、展期、商户装修影响；高德字段可能为空、格式不统一或只表示商场整体；餐饮分时段营业较难用单一 label 表达。 |
| 给方案设计 Agent 的使用建议 | 只有 confidence 高于 `0.65` 时才把营业时间作为硬约束；低 confidence 时应把“可能闭店/闭馆”写入风险，并给同区域备选。收尾卡片不要压在预计关门前 30 分钟内。 |
| 给执行 Agent 的使用建议 | 到达前重新校验营业状态；如果 `is_open_at_arrival=false` 或 confidence 低于 `0.45`，优先提示用户确认并准备替代 POI。 |

推荐输出 JSON 示例：

```json
{
  "provider": "hours",
  "poi_id": "B00155FXB3",
  "hours_label": "09:00-21:00",
  "is_open_at_arrival": true,
  "open_intervals": [
    {
      "start": "09:00",
      "end": "21:00"
    }
  ],
  "source": "amap",
  "confidence": "high"
}
```

## PriceProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`（`amap_cost` + `estimated`）。当前高德 `biz_ext.cost` 已在 `AmapPoiService` 中映射到 `price_per_person`；没有 cost 时再 fallback 到 seed / 类目估算；目前还没有独立 PriceProvider。 |
| 是否有真实 API | 有部分真实字段。高德 `biz_ext.cost` 可作为人均消费或类目相关成本参考，但不是完整票价/菜单/订单 API。 |
| 当前推荐数据来源 | 优先高德 `biz_ext.cost`；当前已在 `backend/app/services/poi_service.py` 的 `AmapPoiService._place_from_amap_item()` 映射到 `price_per_person`。后续建议抽为 `backend/app/services/price_service.py`。 |
| mock / fallback 数据来源 | seed `price_per_person`；类目估算；高德缺失时当前默认值约为 80；未来可接入票务、餐饮、团购或商户价格 API。 |
| 推荐输入字段 | `poi_id`、`name`、`category`、`biz_ext.cost`、`adults`、`children`、`children_age`、`budget`、`planned_activity_type`、`planned_duration_minutes`。 |
| 推荐输出字段 | 当前输出 `price_per_person`。建议扩展为 `price_per_person`、`estimated_total`、`currency`、`price_label`、`included_items`、`source`、`confidence`、`budget_risk`。 |
| confidence 规则 | `0.70`: 高德 `biz_ext.cost` 可解析。`0.60`: seed `price_per_person`。`0.45`: 类目估算。`0.30`: 默认兜底价格。若涉及儿童票、展览特展、套餐、服务费，应下调 `0.10-0.20`。 |
| 限制和风险 | 高德 cost 可能是历史人均、餐饮客单价或粗粒度商户价格；博物馆常有常设展/特展差异；儿童、老人、学生优惠未建模；实际消费会受用户点单影响。 |
| 给方案设计 Agent 的使用建议 | 把价格作为预算排序和风险提示，不要当作最终付款金额。预算紧张时优先选择 confidence 较高且低价的 POI，并保留交通、餐饮和临时消费余量。 |
| 给执行 Agent 的使用建议 | 展示“预计/约”而不是确定价格；用户确认消费或实际付款后应更新剩余预算，并在超预算前触发 replanning。 |

推荐输出 JSON 示例：

```json
{
  "provider": "price",
  "poi_id": "B00155FXB3",
  "avg_price": 68,
  "currency": "CNY",
  "source": "amap",
  "confidence": "medium"
}
```

## QueueProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `estimated`。当前没有稳定公开真实 API；seed 有 `queue_minutes`，高德 POI 当前固定估算排队时间。 |
| 是否有真实 API | 当前没有稳定公开真实 API。未来可能来自合作商户、场馆客流、排队系统、用户实时反馈或自有历史数据。 |
| 当前推荐数据来源 | 使用时间段、类目、天气、商圈热度、节假日、热门 POI、亲子/餐饮场景和用户现场反馈估算。 |
| mock / fallback 数据来源 | seed `queue_minutes`；类目 + 时间段估算；高德 POI 当前可暂按 18 分钟兜底。 |
| 推荐输入字段 | `poi_id`、`name`、`category`、`planned_arrival_at`、`weekday`、`is_holiday`、`weather_condition`、`business_area`、`popularity_level`、`adults`、`children`、`user_reported_wait_minutes`。 |
| 推荐输出字段 | 当前输出 `queue_minutes`，并在 `queue_minutes >= 25` 时生成热门风险标签。建议扩展为 `queue_minutes`、`queue_level`、`source`、`confidence`、`reason`、`valid_until`。 |
| confidence 规则 | `0.55`: seed 明确排队估算。`0.45`: 类目 + 时间段 + 天气估算。`0.35`: 高德结果无排队字段时的固定兜底。`0.25`: 节假日、大型活动、热门展览且没有实时信号。 |
| 限制和风险 | 排队波动最大，且节假日、天气、社交平台热度、临时限流都会让估算失真；当前不具备实时验票/叫号/排队系统数据。 |
| 给方案设计 Agent 的使用建议 | 低 confidence queue 必须转化为时间缓冲和备选点，不要只给一个紧凑路线。亲子、餐饮、热门展馆应默认提高排队风险。 |
| 给执行 Agent 的使用建议 | 到点前询问用户现场排队情况或允许用户手动输入等待时间；超过原估算 15 分钟应触发风险检测和重排。 |

推荐输出 JSON 示例：

```json
{
  "provider": "queue",
  "poi_id": "B00155FXB3",
  "queue_level": "medium",
  "estimated_wait_minutes": 15,
  "source": "estimated",
  "confidence": "low"
}
```

## BookingProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `stub`。当前没有美团合作 API 权限，也没有真实下单/订座/票务确认能力。 |
| 是否有真实 API | 当前没有美团合作 API 权限。不能自动下单、订座、购票或生成真实订单确认。 |
| 当前推荐数据来源 | stub 策略：识别“可能需要预约/购票/订座”的场景，输出 `pending_user_action`，引导用户到官方或可信渠道手动确认。 |
| mock / fallback 数据来源 | stub 响应；POI 类目规则；人工维护的“建议预约”标签；ActionProvider 生成“去预订/去确认”的导航、分享或提醒 payload。 |
| 推荐输入字段 | `poi_id`、`name`、`category`、`planned_arrival_at`、`party_size`、`children`、`user_authorization_state`、`manual_url_or_hint`、`booking_policy_hint`。当前不应要求或保存敏感支付信息。 |
| 推荐输出字段 | `booking_status`、`is_bookable`、`required_user_action`、`manual_url_or_hint`、`deadline`、`source`、`confidence`、`risk_note`。当前阶段必须返回 `pending_user_action` 或 `not_supported`，不允许返回“已预订/已下单”。 |
| confidence 规则 | `0.20`: stub，仅表示系统知道“需要预订/可能需要预订”，不表示已完成。`0.10`: 只有类目推断且无明确渠道。未来真实 API 返回确认号后才可提升到 `0.95`。 |
| 限制和风险 | 没有合作权限不能代表用户订票、订座或付款；不能伪造确认状态；涉及手机号、登录、支付和退款时必须走明确授权与合规流程。 |
| 给方案设计 Agent 的使用建议 | 不要写“已预订”。对热门展馆、餐厅、亲子场馆应标注“建议提前预约/购票”，并在计划中留出用户手动确认动作。 |
| 给执行 Agent 的使用建议 | 只引导用户去官方/可信渠道手动完成；用户没有确认前，booking 状态保持 `stub` 或 `pending_user_action`。如用户反馈不可订，应立即换备选。 |

推荐输出 JSON 示例：

```json
{
  "provider": "booking",
  "poi_id": "B00155FXB3",
  "status": "pending_user_action",
  "supported": false,
  "message": "需要跳转第三方平台完成预订",
  "confidence": "high"
}
```

## ActionProvider

| 项目 | 内容 |
| --- | --- |
| 当前状态 | `hybrid`（`amap_uri` + share/reminder payload），设计态；配置默认值已是 `ACTION_PROVIDER=amap_uri`，但当前没有独立服务接入业务流程。 |
| 是否有真实 API | 导航动作可以真实生成高德 URI / deeplink；分享和提醒当前先输出 payload，由前端 Web Share API、剪贴板、系统日历/通知或执行 Agent 在用户确认后触发。 |
| 当前推荐数据来源 | 高德 URI 规范；POI 名称、地址、经纬度；卡片计划时间；执行 Agent 的用户确认上下文。 |
| mock / fallback 数据来源 | 纯 payload：高德导航 URI、Web 地图 URL、分享文本、提醒时间。没有外部 App 时展示复制地址/坐标；提醒无法落系统通知时输出手动提醒文案。 |
| 推荐输入字段 | `action_type`、`plan_id`、`card_id`、`poi_id`、`name`、`address`、`latitude`、`longitude`、`transport_mode`、`origin_name`、`planned_start_at`、`remind_before_minutes`、`share_context`。 |
| 推荐输出字段 | `action_type`、`label`、`provider`、`uri`、`web_url`、`payload`、`requires_user_confirmation`、`expires_at`、`source`、`confidence`。动作类型必须覆盖 `navigation`、`share`、`reminder`。 |
| confidence 规则 | `0.75`: 有有效坐标和 POI 名称，可生成高德导航 URI。`0.60`: 只有地址/名称，生成搜索或 Web URL。`0.50`: 分享 payload。`0.40`: 提醒 payload 但未接入系统通知确认。 |
| 限制和风险 | 生成 URI 不等于导航已开始；不同平台和高德版本 URI 支持差异较大；提醒和分享通常需要用户确认；payload 不应包含隐私或未授权联系人信息。 |
| 给方案设计 Agent 的使用建议 | 把 Action 当成执行入口，不要当成外部状态证明。每个关键卡片可以预生成导航、分享、提醒动作，但计划语义仍以 Provider 数据和用户确认状态为准。 |
| 给执行 Agent 的使用建议 | 触发动作前展示目标名称、地址、时间，并要求用户确认。导航失败时降级到 Web URL 或复制地址；提醒失败时提示用户手动设置。 |

推荐输出 JSON 示例：

ActionProvider - navigation：

```json
{
  "provider": "action",
  "action_type": "navigation",
  "uri": "amapuri://route/plan/?...",
  "source": "amap"
}
```

ActionProvider - share：

```json
{
  "provider": "action",
  "action_type": "share",
  "payload": {
    "title": "周末外滩散步",
    "content": "推荐路线..."
  }
}
```

ActionProvider - reminder：

```json
{
  "provider": "action",
  "action_type": "reminder",
  "payload": {
    "title": "周末出发提醒",
    "remind_at": "2025-08-24T09:00:00+08:00"
  }
}
```

## Snapshot 通用字段规范

Provider Snapshot 建议统一带上 `provider`、`source`、`confidence` 三类基础字段，方便方案设计 Agent、执行 Agent 和前端做一致判断。

### provider

Provider 类型允许值：

- `poi`
- `route`
- `weather`
- `hours`
- `price`
- `queue`
- `booking`
- `action`

### source

数据来源允许值：

- `amap`
- `open_meteo`
- `seed`
- `estimated`
- `stub`

### confidence

可信度允许值：

- `high`
- `medium`
- `low`

含义约定：

- `high` = 真实数据源直接返回。
- `medium` = 部分真实字段 + 推断。
- `low` = 完全估算或规则生成。

## Agent 可消费的 Provider Snapshot 示例

以下示例用于方案设计 Agent 和执行 Agent 在同一个 POI 上消费资源层快照。字段名不是当前业务 schema 的强约束，后续建议通过统一 Provider envelope 固化。

```json
{
  "hours_snapshot": {
    "provider": "hours",
    "poi_id": "B00155FXB3",
    "hours_label": "09:00-21:00",
    "is_open_at_arrival": true,
    "open_intervals": [
      {
        "start": "09:00",
        "end": "21:00"
      }
    ],
    "source": "amap",
    "confidence": "high"
  },
  "price_snapshot": {
    "provider": "price",
    "poi_id": "B00155FXB3",
    "avg_price": 68,
    "currency": "CNY",
    "source": "amap",
    "confidence": "medium"
  },
  "queue_snapshot": {
    "provider": "queue",
    "poi_id": "B00155FXB3",
    "queue_level": "medium",
    "estimated_wait_minutes": 15,
    "source": "estimated",
    "confidence": "low"
  },
  "booking_snapshot": {
    "provider": "booking",
    "poi_id": "B00155FXB3",
    "status": "pending_user_action",
    "supported": false,
    "message": "需要跳转第三方平台完成预订",
    "confidence": "high"
  },
  "action_snapshot": {
    "actions": [
      {
        "provider": "action",
        "action_type": "navigation",
        "uri": "amapuri://route/plan/?...",
        "source": "amap"
      },
      {
        "provider": "action",
        "action_type": "share",
        "payload": {
          "title": "周末外滩散步",
          "content": "推荐路线..."
        }
      },
      {
        "provider": "action",
        "action_type": "reminder",
        "payload": {
          "title": "周末出发提醒",
          "remind_at": "2025-08-24T09:00:00+08:00"
        }
      }
    ]
  }
}
```

## 当前推荐 env 配置

以下配置项中，`POI_PROVIDER` / `ROUTE_PROVIDER` / `WEATHER_PROVIDER` 已在当前 Settings 和 PlanningService 中生效；`HOURS_PROVIDER` / `PRICE_PROVIDER` / `QUEUE_PROVIDER` / `BOOKING_PROVIDER` / `ACTION_PROVIDER` 属于资源层推荐配置，需在后续 Provider 抽象中继续接入业务流程。

以下配置适合本地或演示环境启用尽可能多的真实数据，同时保留 fallback：

```env
APP_ENV=local
APP_VERSION=0.1.0
DATABASE_URL=sqlite:///./life_agent.db
DATABASE_AUTO_CREATE=true
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

PLANNING_PROVIDER=shanghai_seed
POI_PROVIDER=amap
ROUTE_PROVIDER=amap
WEATHER_PROVIDER=open_meteo
HOURS_PROVIDER=hybrid
PRICE_PROVIDER=estimated
QUEUE_PROVIDER=estimated
BOOKING_PROVIDER=stub
ACTION_PROVIDER=amap_uri

AMAP_API_KEY=<your-amap-web-service-key>
```

如果没有高德 Key，可保持 `POI_PROVIDER=seed`、`ROUTE_PROVIDER=estimated`，但方案设计 Agent 必须把 POI 和路线 confidence 降级处理。

## 后续任务清单

| 优先级 | 任务 | 目标 |
| --- | --- | --- |
| P0 | 增加统一 Provider 响应 envelope | 为所有 Provider 输出 `source`、`confidence`、`updated_at`、`raw_source`、`fallback_reason`，方便 Agent 决策和日志追踪。 |
| P0 | 抽象 HoursProvider | 解析高德 `open_time` / `biz_ext.open_time`，结构化判断计划到达时是否营业，并保留类目估算 fallback。 |
| P0 | 抽象 PriceProvider | 将 `biz_ext.cost`、seed 价格和类目估算统一为预算模型，输出人均、总价和预算风险。 |
| P0 | 标记 Route fallback 原因 | 当地铁或高德失败时，把 estimated 状态显式传给方案设计 Agent 和执行 Agent。 |
| P1 | 实现 ActionProvider `amap_uri` | 为导航、分享、提醒生成可消费 payload，并在前端卡片按钮中接入。 |
| P1 | 增加 Provider 单元测试 | 覆盖高德/Open-Meteo 成功、异常、字段缺失、fallback 和 confidence 规则。 |
| P1 | 增加简单缓存与限流 | 对 POI、Route、Weather 请求按 key 缓存，降低 API 配额消耗和超时风险。 |
| P1 | 增强 QueueProvider 估算 | 接入星期、节假日、天气、热门类目和用户现场反馈，形成可解释的排队风险。 |
| P2 | 接入真实地铁/公交路线 | 评估高德公交/地铁接口或其它城市交通数据源，替换当前地铁估算。 |
| P2 | Booking 合作接口预研 | 明确美团或商户 API 权限、授权流程、订单状态、支付和隐私合规边界。 |
| P2 | 城市与时间泛化 | 从固定上海当前天气/POI，演进到按城市、区县、日期、时段动态查询。 |

## 下一步 Mock 数据文件建议

为便于方案设计 Agent、执行 Agent 和前端在 Provider 抽象完成前稳定联调，以下 mock 数据文件已创建。文件只承载资源层样例，不应伪造真实预订、下单或实时排队状态。

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `backend/docs/mock/hours_mock.json` | 已创建 | 提供外滩、上海自然博物馆、新天地的营业时间、结构化开闭店区间、`source` 和 `confidence`，用于 HoursProvider 原型和营业风险展示。 |
| `backend/docs/mock/price_mock.json` | 已创建 | 提供 3 个上海 POI 的人均价格、家庭总价估算、币种、来源和可信度，用于 PriceProvider 原型和预算推演。 |
| `backend/docs/mock/queue_mock.json` | 已创建 | 提供排队等级、预计等待分钟数和估算原因，用于 QueueProvider 原型和执行中重排测试。 |
| `backend/docs/mock/booking_mock.json` | 已创建 | 提供 `pending_user_action` stub 数据，强调不能表达“已预订/已下单”，用于 BookingProvider 联调。 |
| `backend/docs/mock/action_mock.json` | 已创建 | 提供 `navigation` 高德 URI、`share` 文本 payload、`reminder` 时间 payload，用于 ActionProvider `amap_uri` + share/reminder payload 联调。 |

## Provider 状态总表

| Provider | 当前状态 | 真实 API |
| --- | --- | --- |
| POI | 已接入 | 是 |
| Route | 已接入 | 是 |
| Weather | 已接入 | 是 |
| Hours | Hybrid 设计 | 部分 |
| Price | Hybrid 设计 | 部分 |
| Queue | Estimated | 否 |
| Booking | Stub | 否 |
| Action | Hybrid(amap_uri + payload) | 部分 |
