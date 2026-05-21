# 当前验收清单

本文档记录当前已经验证过的前后端主链路。每次改动 Dashboard、规划页、确认页、API client、后端风险/重规划逻辑后，建议按此清单快速验收。

## 启动方式

后端：

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run fastapi dev app/main.py
```

前端：

```powershell
cd E:\Meituan_AI
npm run dev
```

浏览器打开 Vite 输出的地址，通常是：

```text
http://localhost:5173
```

## 自动化验证

后端：

```powershell
cd E:\Meituan_AI\backend
$env:UV_CACHE_DIR='E:\Meituan_AI\backend\.uv-cache'
uv run ruff check .
uv run pytest
```

当前应通过：

```text
7 passed
```

前端：

```powershell
cd E:\Meituan_AI
npm run build
```

## 首页验收

- 页面没有横向滚动条。
- 底部场景按钮不会被悬浮卡片卡住。
- 点击快捷场景只更新首页输入内容，不应产生 Dashboard 风险。
- 点击“帮我安排”后进入规划页。

## 规划页验收

- 页面内部可以纵向滚动。
- 进度到 100% 后可以看到“查看我的周末方案”按钮。
- 点击“查看我的周末方案”进入 Dashboard。
- 页面不应该依赖浏览器页面级滚动条才能看到底部按钮。

## Dashboard 布局验收

- 页面没有左右横向滚动条。
- 左栏、中栏、右栏可以各自自由滚动。
- 三栏滚动时顶部导航稳定。
- 中栏底部进度/标语区域不会被页面级滚动干扰。

## Dashboard 风险验收

### 排队变长

1. 点击“排队变长”。
2. 中间栏出现风险提示。
3. 受影响卡片变成风险样式。
4. 点击“按这个调整”。
5. 进入重新规划动画。
6. 动画结束后回到可执行状态，并出现新方案卡片。

### 突然下雨

1. 点击“突然下雨”。
2. 中间栏风险提示应切换为下雨相关内容。
3. 点击“按这个调整”。
4. 新路线应出现室内亲子备选。

### 孩子累了

1. 点击“孩子累了”。
2. 中间栏风险提示应切换为孩子累了相关内容。
3. 点击“按这个调整”。
4. 新路线应出现放慢节奏/休息点相关安排。

### 风险切换

1. 先点“排队变长”。
2. 不点“暂不调整”，直接点“突然下雨”。
3. 中间栏应切换到下雨风险，而不是继续显示排队风险。
4. 再点“孩子累了”，中间栏应继续切换到孩子累了风险。
5. 当前风险被替换时，上一轮风险卡片状态应恢复。

## 聊天框验收

- 点击快捷词“孩子有点累了”只会把文本填入输入框，中间栏不应提前变化。
- 点击“发送”后，才会触发 `/requirements` 并显示对应风险。
- “突然下雨”“排队变长”同理。
- 输入普通偏好，例如“预算再省一点”，应该追加日志或提示，不应强制进入风险重规划。

## 确认页验收

- Dashboard 点击“确认安排”后进入确认页。
- 确认页可以看到执行项列表。
- 点击任意“执行此项”后，下方应出现标语/反馈文案。
- 确认页不应出现横向滚动。

## 后端闭环验收

用浏览器或接口工具验证：

1. `POST /api/plans` 创建方案。
2. `POST /api/plans/{plan_id}/risks/scan` 分别传 `queue`、`weather`、`fatigue`。
3. 每次 scan 返回 `risk_id` 后，调用 `POST /api/plans/{plan_id}/risks/{risk_id}/replan`。
4. 三类风险都应返回 `status: EXECUTING`、递增 `version`、新的 `cards`。

## 已知边界

- 当前后端仍是 mock-compatible 业务数据，还没有接真实地图、天气、排队、餐厅预约服务。
- 前端保留 mock fallback；如果后端未启动，演示仍可继续，但不代表 API 闭环被验证。
- `time`、`budget`、`closure` 风险类型已预留，但还没有完整重规划策略。


## Milestone 8 Session 验收

- 首次打开前端时会生成匿名 `session_id`，并保存在浏览器 `localStorage`。
- 创建方案时，`POST /api/plans` 请求体应包含同一个 `session_id`。
- 刷新页面后再次创建方案，应复用同一个浏览器 `session_id`。
- Dashboard 顶部点击“我的方案”时，应调用 `GET /api/plans?session_id=...`。
- 当前 session 下的历史方案应显示在“我的方案”浮层中。
- 后端未启动时，前端 mock fallback 仍可完成演示，但不代表 session API 闭环已被真实验证。
