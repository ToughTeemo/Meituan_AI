# Provider Contracts

本文档定义资源层 Provider 的输入输出契约，供方案设计 Agent、执行 Agent 和前端同学对齐使用。当前已真实接入 POI、路线、天气；Hours、Price、Queue、Booking、Action 仍以资源层设计和 mock 数据支撑后续接入。

## 1. 通用约定

所有 Provider Snapshot 建议包含以下基础字段：

- `provider`: Provider 类型。
- `source`: 数据来源。
- `confidence`: 可信度等级。
- `updated_at`: 数据生成或刷新时间，ISO 8601 字符串。
- `fallback_reason`: 触发 fallback 的原因；没有 fallback 时为 `null`。
- `raw_source`: 可选，原始数据片段或来源摘要，供调试使用，不建议直接展示给用户。

`source` 允许值：

- `amap`
- `open_meteo`
- `seed`
- `estimated`
- `stub`

`confidence` 允许值：

- `high`
- `medium`
- `low`
- `unknown`

可信度语义：

- `high`: 真实数据源直接返回，字段完整且可解析。
- `medium`: 部分真实字段 + Provider 推断或补齐。
- `low`: 完全估算、规则生成或 seed/mock 数据。
- `unknown`: 来源异常、字段不足或尚未实现评分规则。

## 2. PoiProvider Contract

输入 JSON 示例：

```json
{
  "keyword": "亲子展馆",
  "city": "上海",
  "limit": 8,
  "constraints": {
    "goal": "周末带孩子在上海玩半天",
    "budget": 500,
    "preference_tags": ["亲子", "室内优先", "地铁方便"],
    "transport_mode": "地铁"
  }
}
```

输出 JSON 示例：

```json
{
  "provider": "poi",
  "poi_id": "amap_B00155FXB3",
  "external_id": "B00155FXB3",
  "name": "上海自然博物馆",
  "category": "亲子展馆",
  "address": "北京西路510号",
  "district": "静安区",
  "latitude": 31.2354,
  "longitude": 121.4622,
  "rating": 4.8,
  "price_per_person": 30,
  "queue_minutes": 25,
  "hours_label": "09:00-17:00",
  "source": "amap",
  "confidence": "high",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": null
}
```

当前真实来源是 `AmapPoiService`，调用高德 Place Search。高德失败、无 API Key、返回结构异常或无可用 POI 时，fallback 到 `ShanghaiSeedPoiService`。

## 3. RouteProvider Contract

输入 JSON 示例：

```json
{
  "origin": {
    "name": "人民广场",
    "latitude": 31.2304,
    "longitude": 121.4737
  },
  "destination": {
    "name": "上海自然博物馆",
    "latitude": 31.2354,
    "longitude": 121.4622
  },
  "transport_mode": "步行"
}
```

输出 JSON 示例：

```json
{
  "provider": "route",
  "mode": "步行",
  "distance_km": 1.2,
  "duration_minutes": 16,
  "summary": "步行约 16 分钟，距离约 1.2 公里",
  "source": "amap",
  "confidence": "high",
  "fallback_reason": null,
  "updated_at": "2026-06-02T10:00:00+08:00"
}
```

当前 `AmapRouteService` 支持高德 `driving` / `walking`。地铁、未知交通模式、无 API Key 或高德失败时，fallback 到 `EstimatedShanghaiRouteService`，此时必须降低 `confidence` 并记录 `fallback_reason`。

## 4. WeatherProvider Contract

输入 JSON 示例：

```json
{
  "city": "上海",
  "latitude": 31.2304,
  "longitude": 121.4737,
  "planned_at": "2026-06-02T14:00:00+08:00"
}
```

输出 JSON 示例：

```json
{
  "provider": "weather",
  "condition": "cloudy",
  "temperature_c": 24,
  "rain_probability": 20,
  "prefers_indoor": false,
  "summary": "上海当前无明显降雨，室内外路线都可作为候选。",
  "source": "open_meteo",
  "confidence": "high",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": null
}
```

当前 `OpenMeteoWeatherService` 已真实接入 Open-Meteo。请求异常、字段不可解析或超时时，fallback 到 `SeedWeatherService`。

## 5. HoursProvider Contract

输入 JSON 示例：

```json
{
  "poi_id": "B00155FXB3",
  "name": "上海自然博物馆",
  "category": "亲子展馆",
  "planned_arrival_at": "2026-06-02T13:30:00+08:00",
  "raw_open_time": "09:00-17:00"
}
```

输出 JSON 示例：

```json
{
  "provider": "hours",
  "poi_id": "B00155FXB3",
  "hours_label": "09:00-17:00",
  "is_open_at_arrival": true,
  "open_intervals": [
    {
      "start": "09:00",
      "end": "17:00"
    }
  ],
  "source": "amap",
  "confidence": "high",
  "fallback_reason": null,
  "updated_at": "2026-06-02T10:00:00+08:00"
}
```

当前为 `hybrid` 设计：优先读取高德 POI `open_time` / `biz_ext.open_time`，没有真实营业字段时按类目估算，并将 `source` 设为 `estimated` 或 `seed`。

## 6. PriceProvider Contract

输入 JSON 示例：

```json
{
  "poi_id": "B00155FXB3",
  "category": "亲子展馆",
  "raw_cost": 30,
  "adults": 2,
  "children": 1,
  "budget": 500
}
```

输出 JSON 示例：

```json
{
  "provider": "price",
  "poi_id": "B00155FXB3",
  "avg_price": 30,
  "currency": "CNY",
  "estimated_total": 90,
  "budget_risk": "low",
  "source": "amap",
  "confidence": "medium",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": null
}
```

当前为 `hybrid` 设计：优先使用高德 `biz_ext.cost`；没有 cost 时使用 seed `price_per_person` 或类目估算。高德 cost 不是完整票务或菜单价格，不能承诺最终付款金额。

## 7. QueueProvider Contract

输入 JSON 示例：

```json
{
  "poi_id": "sh_xintiandi",
  "category": "街区餐饮",
  "planned_arrival_at": "2026-06-02T18:30:00+08:00",
  "weather_condition": "cloudy",
  "business_area": "新天地",
  "is_holiday": false
}
```

输出 JSON 示例：

```json
{
  "provider": "queue",
  "poi_id": "sh_xintiandi",
  "queue_level": "medium",
  "estimated_wait_minutes": 20,
  "reason": "evening_restaurant_business_area",
  "source": "estimated",
  "confidence": "low",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": "no_public_realtime_queue_api"
}
```

当前没有稳定公开真实 API，必须使用 `estimated`。QueueProvider 不允许伪装成实时排队数据；Agent 和前端展示时应使用“预计/估算”等措辞。

## 8. BookingProvider Contract

输入 JSON 示例：

```json
{
  "poi_id": "sh_natural_history",
  "name": "上海自然博物馆",
  "planned_arrival_at": "2026-06-02T13:30:00+08:00",
  "party_size": 3,
  "user_authorized": false
}
```

输出 JSON 示例：

```json
{
  "provider": "booking",
  "poi_id": "sh_natural_history",
  "status": "pending_user_action",
  "supported": false,
  "required_user_action": "用户前往官方渠道确认预约和购票状态",
  "message": "当前没有美团合作 API 权限，不能自动预订或下单。",
  "source": "stub",
  "confidence": "high",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": "booking_api_not_available"
}
```

当前为 `stub`，没有美团合作 API 权限。不允许返回“已预订”“已下单”“已付款”等真实动作完成状态，只能返回 `pending_user_action` 或 `not_supported`。

## 9. ActionProvider Contract

输入 JSON 示例：

```json
{
  "plan_id": "plan_demo_001",
  "card_id": "card_sh_xintiandi",
  "poi": {
    "poi_id": "sh_xintiandi",
    "name": "新天地",
    "address": "太仓路181弄",
    "latitude": 31.2197,
    "longitude": 121.4758
  },
  "action_types": ["navigation", "share", "reminder"]
}
```

输出 JSON 示例：

```json
{
  "provider": "action",
  "source": "amap",
  "confidence": "medium",
  "updated_at": "2026-06-02T10:00:00+08:00",
  "fallback_reason": null,
  "actions": [
    {
      "action_type": "navigation",
      "label": "导航到新天地",
      "uri": "amapuri://route/plan/?dlat=31.2197&dlon=121.4758&dname=%E6%96%B0%E5%A4%A9%E5%9C%B0&dev=0&t=2",
      "requires_user_confirmation": true
    },
    {
      "action_type": "share",
      "label": "分享新天地行程",
      "payload": {
        "title": "新天地晚餐和街区散步",
        "content": "建议晚餐前确认餐厅排队情况，必要时切换同商圈备选点。"
      },
      "requires_user_confirmation": true
    },
    {
      "action_type": "reminder",
      "label": "新天地订座提醒",
      "payload": {
        "title": "确认新天地餐厅订座",
        "remind_at": "2026-06-02T17:00:00+08:00"
      },
      "requires_user_confirmation": true
    }
  ]
}
```

`navigation` 使用高德 URI / `amap_uri`。`share` 只输出分享文本 payload。`reminder` 只输出提醒时间 payload。分享和提醒是否真正触发，由前端或执行 Agent 在用户确认后完成。

## 10. Agent 使用建议

方案设计 Agent：

- 使用 `provider`、`source`、`confidence` 判断数据可用性和风险等级。
- 高 confidence 的 POI、路线、天气可进入主线方案；low confidence 的 Hours、Queue、Price 应转化为风险提示和备选方案。
- 不要只基于 POI 价格、营业时间或排队字段做硬承诺，应叠加对应 Provider Snapshot。
- Booking 只能表达“需要用户确认”，不能写成“已预订”。

执行 Agent：

- 每次执行关键卡片前刷新 Route、Weather、Hours、Queue。
- 遇到 fallback 时保留 `fallback_reason`，并降低执行确定性。
- 用户现场反馈与 Provider 估算冲突时，以用户反馈优先，并触发 replanning。
- 触发 Booking、Action 前必须要求用户确认。

前端：

- 直接消费 ActionProvider 的 `actions` 数组渲染按钮。
- `navigation.uri` 可作为高德跳转入口；失败时降级为复制地址或 Web URL。
- `share.payload` 交给 Web Share API、剪贴板或分享弹窗。
- `reminder.payload` 交给系统提醒、日历或前端提醒弹窗；不能默认认为提醒已创建。

## 11. Fallback 原则

- 真实 API 失败不能中断规划，应返回可解释的 fallback Snapshot。
- fallback 必须降低 `confidence`。
- `fallback_reason` 必须保留，方便 Agent 决策和日志追踪。
- `raw_source` 可选保留调试信息，但不应直接展示给用户。
- Booking stub 不能假装完成真实动作。
- Queue estimated 不能假装实时。
- 任何估算数据都应在前端和 Agent 文案中使用“预计”“估算”“建议确认”等措辞。

## 12. 与 mock 文件关系

`backend/docs/mock/*.json` 是本契约的样例数据，可用于：

- 前端联调：在无后端 Provider 抽象时验证 UI 和交互。
- Agent 单测：构造不同 `source`、`confidence`、`fallback_reason` 的决策输入。
- 无 API Key 环境演示：在不访问高德、Open-Meteo、美团等外部服务时保持方案可运行。

mock 文件不代表真实外部状态，尤其不能将 `booking_mock.json` 当作真实订单数据，也不能将 `queue_mock.json` 当作实时排队数据。
