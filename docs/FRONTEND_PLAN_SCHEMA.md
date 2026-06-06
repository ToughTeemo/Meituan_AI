# Frontend Plan Schema

## 1. Schema 用途

这份 Schema 用于前端、后端、LLM 规划模块统一数据结构，核心目标是让不同同学围绕同一份 `Constraints` 和 `PlanBundle` 对齐接口。

- 前端 UI 可以直接渲染 `PlanBundle`
- 后端返回结构稳定，减少字段名临时变更
- LLM 输出 JSON 可以被校验、修正和降级
- mock fallback 和真实 API 结果保持同构

当前前端仍保留已有 demo 字段，例如 `card_id`、`poi_id`、`start_minute`、`duration_minutes`、`risk_id`。新增字段优先服务前后端联调，不要求立即重写现有 UI。

## 2. 核心数据流

```text
用户输入自然语言
-> POST /api/parse-goal
-> 得到 Constraints
-> POST /api/generate-plan
-> 得到 PlanBundle
-> 前端进入方案页
-> 风险触发或用户补充
-> POST /api/replan
-> 得到新的 PlanBundle
-> 用户确认
-> POST /api/confirm
```

## 3. 最小可联调接口

### POST /api/parse-goal

输入：`ParseGoalRequest`

输出：`ParseGoalResponse`

用途：把用户自然语言解析为结构化 `Constraints`，并返回可能的解析告警。

### POST /api/generate-plan

输入：`GeneratePlanRequest`

输出：`GeneratePlanResponse`

用途：基于 `Constraints` 生成完整 `PlanBundle`。

### POST /api/replan

输入：`ReplanRequest`

输出：`ReplanResponse`

用途：在风险触发、用户接受调整、用户拒绝调整或用户补充偏好时，返回新的 `PlanBundle`，并通过 `changedCardIds` 告诉前端哪些卡片发生变化。

### POST /api/confirm

输入：`ConfirmPlanRequest`

输出：`ConfirmPlanResponse`

用途：用户确认方案后保存最终计划。

## 4. 给 B 同学的对齐说明

B 同学负责天气、地图、店铺 API，需要重点填充以下字段：

- `POI`
- `RouteSegment`
- `queueMinutes`
- `queueLevel`
- `reservationStatus`
- `openingHours`
- `rating`
- `avgPrice`
- `familyFriendly`
- `petFriendly`
- `indoor`
- `map.markers`
- `map.routePolyline`

补充建议：地图和店铺侧返回的数据可以先转换为 `POI` 和 `RouteSegment`，再拼进 `PlanCard`，不要让页面直接消费第三方 API 原始结构。

## 5. 给 C 同学的对齐说明

C 同学负责执行层、状态流转、联调，需要重点关注以下字段：

- `PlanBundle.status`
- `PlanCard.status`
- `RiskSignal`
- `progress`
- `confirm` 接口
- `replan` 后的 `changedCardIds`
- `fallback` 状态
- loading / error / retry / reset 的前端状态

补充建议：执行层可以把 `PlanBundle.status` 作为整体流程状态，把 `PlanCard.status` 作为单卡片展示状态；当 `source` 或 `status` 为 `fallback` 时，前端需要保留可演示能力。

## 6. 给 A 同学自己的对齐说明

A 同学负责需求理解、方案设计、动态调整，需要重点关注以下字段：

- `Constraints`
- `PlanSummary`
- `PlanCard.reason`
- `PlanCard.adjustmentNote`
- `RiskSignal.suggestedAction`
- `ReplanRequest` / `ReplanResponse`
- 预算校验、时间校验、返程校验

补充建议：LLM 输出时应优先保证 `constraints`、`summary`、`cards`、`risks` 的完整性；如果预算、时间或返程校验失败，应通过 `warnings`、`RiskSignal` 或 `fallbackReason` 显式说明。

## 7. 完整 JSON 示例

场景：“今天下午带孩子出去玩，不想太累，预算500，晚上8点前回家”

```json
{
  "planId": "plan_family_chaoyang_001",
  "version": 1,
  "status": "ready",
  "source": "llm",
  "constraints": {
    "goalText": "今天下午带孩子出去玩，不想太累，预算500，晚上8点前回家",
    "city": "Beijing",
    "origin": {
      "name": "芍药居",
      "address": "北京市朝阳区芍药居",
      "lat": 39.9776,
      "lng": 116.4351
    },
    "timeWindow": {
      "start": "14:00",
      "end": "20:00",
      "mustReturnBy": "20:00"
    },
    "participants": {
      "adults": 2,
      "children": 1,
      "childAges": [5],
      "pets": 0
    },
    "budget": {
      "amount": 500,
      "currency": "CNY",
      "scope": "total"
    },
    "transportPreference": "subway",
    "pacePreference": "relaxed",
    "sceneType": "family",
    "preferences": ["亲子友好", "少排队", "预算可控", "少换乘"],
    "avoidances": ["太累", "排队太久", "走太远"],
    "weatherSensitive": true,
    "createdAt": "2026-06-01T14:00:00+08:00"
  },
  "summary": {
    "title": "轻松亲子半日游",
    "subtitle": "少换乘、少等待，适合带孩子轻松玩半天。",
    "totalBudget": 276,
    "budgetLimit": 500,
    "currency": "CNY",
    "totalDurationMinutes": 360,
    "expectedReturnTime": "19:55",
    "tags": ["亲子", "地铁", "低强度", "晚餐已安排"],
    "recommendationReason": "路线围绕朝阳公园和附近室内休息点展开，减少换乘和步行，并预留晚餐与返程时间。"
  },
  "cards": [
    {
      "id": "c1",
      "title": "地铁出发",
      "subtitle": "芍药居到朝阳公园",
      "type": "transport",
      "status": "done",
      "startTime": "14:00",
      "endTime": "14:25",
      "durationMinutes": 25,
      "poi": {
        "id": "p_metro_1",
        "name": "芍药居站",
        "type": "transport",
        "categoryLabel": "地铁站",
        "address": "北京市朝阳区芍药居",
        "lat": 39.9776,
        "lng": 116.4351,
        "queueMinutes": 0,
        "queueLevel": "low",
        "familyFriendly": true,
        "tags": ["地铁", "出发点"]
      },
      "route": {
        "fromPoiId": "home_shaoyaoju",
        "toPoiId": "p_park_chaoyang",
        "mode": "subway",
        "durationMinutes": 25,
        "distanceKm": 6.8,
        "cost": 8,
        "transferCount": 0,
        "crowdLevel": "medium",
        "summary": "地铁直达附近站点，步行距离较短。"
      },
      "cost": 8,
      "statusText": "已出发",
      "reason": "地铁稳定且预算低，适合亲子半日路线。"
    },
    {
      "id": "c2",
      "title": "朝阳公园轻松游玩",
      "subtitle": "低强度户外活动",
      "type": "activity",
      "status": "adjusted",
      "startTime": "14:30",
      "endTime": "16:00",
      "durationMinutes": 90,
      "poi": {
        "id": "p_park_chaoyang",
        "name": "朝阳公园",
        "type": "park",
        "categoryLabel": "亲子公园",
        "address": "北京市朝阳区朝阳公园南路1号",
        "lat": 39.9335,
        "lng": 116.4789,
        "rating": 4.7,
        "avgPrice": 10,
        "currency": "CNY",
        "openingHours": "06:00-22:00",
        "queueMinutes": 35,
        "queueLevel": "high",
        "reservationStatus": "unknown",
        "familyFriendly": true,
        "petFriendly": true,
        "indoor": false,
        "tags": ["户外", "亲子", "可控预算"]
      },
      "cost": 30,
      "statusText": "已动态调整",
      "reason": "空间开阔，孩子活动自由，家长负担较低。",
      "adjustmentNote": "已调整：儿童活动区排队变长，缩短高排队项目停留，改为草坪和湖边轻松游玩。",
      "risks": [
        {
          "id": "r_queue_001",
          "type": "queue",
          "level": "medium",
          "title": "儿童活动排队变长",
          "description": "朝阳公园儿童活动区等待时间上升到约35分钟。",
          "affectedCardIds": ["c2"],
          "detectedAt": "2026-06-01T15:10:00+08:00",
          "suggestedAction": "缩短高排队项目，提前转入室内休息点。",
          "requiresUserConfirm": true
        }
      ],
      "alternatives": [
        {
          "id": "p_bookstore_family",
          "name": "亲子书店",
          "type": "bookstore",
          "categoryLabel": "室内休息",
          "lat": 39.9329,
          "lng": 116.4862,
          "rating": 4.6,
          "avgPrice": 35,
          "currency": "CNY",
          "queueMinutes": 5,
          "queueLevel": "low",
          "familyFriendly": true,
          "indoor": true,
          "tags": ["室内", "少排队"]
        }
      ]
    },
    {
      "id": "c3",
      "title": "甜品 / 室内休息点",
      "subtitle": "补充体力，避开排队高峰",
      "type": "rest",
      "status": "upcoming",
      "startTime": "16:10",
      "endTime": "17:00",
      "durationMinutes": 50,
      "poi": {
        "id": "p_dessert_rest",
        "name": "蓝湾甜品休息点",
        "type": "cafe",
        "categoryLabel": "甜品 / 室内休息",
        "address": "朝阳公园附近商圈",
        "lat": 39.9347,
        "lng": 116.4868,
        "rating": 4.5,
        "avgPrice": 45,
        "currency": "CNY",
        "openingHours": "10:00-21:30",
        "queueMinutes": 5,
        "queueLevel": "low",
        "reservationStatus": "available",
        "familyFriendly": true,
        "indoor": true,
        "tags": ["室内", "甜品", "休息"]
      },
      "cost": 90,
      "reason": "在晚餐前安排室内休息，降低孩子疲劳风险。"
    },
    {
      "id": "c4",
      "title": "眉州东坡亲子晚餐",
      "subtitle": "家庭友好，预算可控",
      "type": "meal",
      "status": "upcoming",
      "startTime": "17:30",
      "endTime": "18:50",
      "durationMinutes": 80,
      "poi": {
        "id": "p_meizhou_dongpo",
        "name": "眉州东坡",
        "type": "restaurant",
        "categoryLabel": "亲子晚餐",
        "address": "朝阳公园附近商圈",
        "lat": 39.936,
        "lng": 116.489,
        "rating": 4.6,
        "avgPrice": 80,
        "currency": "CNY",
        "openingHours": "10:00-22:00",
        "queueMinutes": 10,
        "queueLevel": "low",
        "reservationStatus": "available",
        "familyFriendly": true,
        "indoor": true,
        "tags": ["家庭餐厅", "亲子", "晚餐"]
      },
      "cost": 160,
      "reason": "餐厅对家庭友好，晚餐时间可控，返程前仍有缓冲。"
    },
    {
      "id": "c5",
      "title": "地铁返程",
      "subtitle": "晚 8 点前回家",
      "type": "return",
      "status": "upcoming",
      "startTime": "19:05",
      "endTime": "19:55",
      "durationMinutes": 50,
      "poi": {
        "id": "p_metro_return",
        "name": "地铁返程站",
        "type": "transport",
        "categoryLabel": "地铁站",
        "lat": 39.9363,
        "lng": 116.4882,
        "queueMinutes": 0,
        "queueLevel": "low",
        "familyFriendly": true,
        "tags": ["返程", "地铁"]
      },
      "route": {
        "fromPoiId": "p_meizhou_dongpo",
        "toPoiId": "home_shaoyaoju",
        "mode": "subway",
        "durationMinutes": 50,
        "distanceKm": 7.2,
        "cost": 8,
        "transferCount": 0,
        "crowdLevel": "medium",
        "summary": "晚高峰后返程，预计 19:55 到家。"
      },
      "cost": 8,
      "reason": "保留返程缓冲，满足晚上8点前回家的硬约束。"
    }
  ],
  "risks": [
    {
      "id": "r_queue_001",
      "type": "queue",
      "level": "medium",
      "title": "儿童活动排队变长",
      "description": "朝阳公园儿童活动区等待时间上升到约35分钟。",
      "affectedCardIds": ["c2"],
      "detectedAt": "2026-06-01T15:10:00+08:00",
      "suggestedAction": "缩短高排队项目，提前转入室内休息点。",
      "requiresUserConfirm": true
    }
  ],
  "map": {
    "currentCardId": "c2",
    "routePolyline": [
      { "lat": 39.9776, "lng": 116.4351 },
      { "lat": 39.9335, "lng": 116.4789 },
      { "lat": 39.9347, "lng": 116.4868 },
      { "lat": 39.936, "lng": 116.489 },
      { "lat": 39.9776, "lng": 116.4351 }
    ],
    "markers": [
      {
        "id": "m_home",
        "poiId": "home_shaoyaoju",
        "label": "出发地",
        "lat": 39.9776,
        "lng": 116.4351,
        "type": "normal"
      },
      {
        "id": "m_park",
        "poiId": "p_park_chaoyang",
        "cardId": "c2",
        "label": "朝阳公园",
        "lat": 39.9335,
        "lng": 116.4789,
        "type": "risk"
      },
      {
        "id": "m_dessert",
        "poiId": "p_dessert_rest",
        "cardId": "c3",
        "label": "甜品休息",
        "lat": 39.9347,
        "lng": 116.4868,
        "type": "next"
      },
      {
        "id": "m_dinner",
        "poiId": "p_meizhou_dongpo",
        "cardId": "c4",
        "label": "眉州东坡",
        "lat": 39.936,
        "lng": 116.489,
        "type": "normal"
      }
    ]
  },
  "progress": {
    "currentStep": 2,
    "totalSteps": 5,
    "percent": 40,
    "message": "正在朝阳公园轻松游玩，已根据排队风险调整后续节奏。"
  },
  "updatedAt": "2026-06-01T15:12:00+08:00",
  "debug": {
    "traceId": "trace_20260601_family_001",
    "llmUsed": true
  }
}
```

## 8. 兼容性说明

- 当前前端 demo 仍可继续使用旧字段：`card_id`、`type: "transit"`、`status: "active"`、`poi.poi_id`、`risk_id` 等。
- 联调接口建议逐步补齐新字段：`planId`、`summary`、`constraints.goalText`、`cards[].reason`、`map.markers` 等。
- mock fallback 与真实 API 应返回相同层级的数据结构，允许在过渡期保留旧字段。
- 不要求 UI 页面立即改造，页面消费字段的迁移可以后续单独处理。
