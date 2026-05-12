# FINAL PRD（最终版）

## 1. 项目概述

**项目名称**：本地生活 AI Agent — 生活任务驾驶舱  
**演示场景**：美团黑客松 Demo  
**核心定位**：不是聊天机器人，而是“生活任务编排与执行”的可视化驾驶舱。  
**工程约束（必须遵守）**：

- 不接真实 API / 不接真实地图
- 单页 SPA（不新增页面、不引入后端）
- 不做完整聊天系统（无消息列表、无用户/AI 气泡、多轮对话不实现）
- 所有交互由 mock 数据 + 状态机驱动
- build 必须通过（`npm run build`）

---

## 2. 最终页面结构（三列 Layla 风格）

应用为 100vh 单页三列并排结构，列内独立滚动，尽量避免浏览器整体纵向滚动条。

### 2.1 组件树（最终实现）

App  
└── `DashboardProviders`（Plan / Machine / UI 三 Context + `RiskRuntime`）  
&nbsp;&nbsp;&nbsp;&nbsp;└── `DashboardLayout`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `ThreeColumnWorkspace`（三列容器）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `LeftMissionColumn`（左列：任务与控场）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├── `MissionInputCard`（当前任务卡）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├── `AIRequestBox`（与 AI 对话/输入新要求：仅输入区）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;└── `DemoControls`（演示控制台：内嵌）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `CenterTimelineColumn`（中列：主视觉）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├── 顶部标题 + 当前阶段/风险摘要  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├── `RiskWarningBar`（标题下方）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├── `VerticalTimelinePanel`（纵向时间轴轨道 + ReplanOverlay）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;└── `AgentLogBar`（底部日志区）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `RightMapColumn`（右列：地图与详情）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `MapStatusPanel`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `MockMapView`（SVG 示意地图：路线 + POI）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `CardDetail`（聚焦卡片详情：POI 等）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `AlternativesPanel`（替代方案列表）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `AgentReasoningBubble`（推理提示：inline）  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `PlanContextCard`（计划上下文补充）

### 2.2 三列职责

- **左列（任务与控场）**
  - `MissionInputCard`：只读展示当前任务与约束概览（目标/副标题/标签/出发地/时间/成员/预算/状态），按钮为 mock（不接 LLM）。
  - `AIRequestBox`：用户打断/补充要求输入区（不是聊天系统）。
  - `DemoControls`：演示控制台（模拟风险/重置/自动风险开关），以产品内嵌卡片形式呈现。

- **中列（主视觉：纵向时间轴）**
  - `VerticalTimelinePanel`：纵向时间轴（按 `start_minute` 排序，自上而下），负责 ReplanOverlay 覆盖与 freezing blur/opacity。
  - `RiskWarningBar`：显示风险原因与“接受建议/忽略”，触发 ReplanFlow 或回到执行态。
  - `AgentLogBar`：记录 AI/系统的执行轨迹（非对话）。

- **右列（地图与详情）**
  - `MockMapView`：SVG 示意地图（非真实地理），显示路线与 POI，高亮聚焦点。
  - `CardDetail` + `AlternativesPanel`：展示聚焦卡片信息与替代方案。
  - `AgentReasoningBubble`：Replan 完成后的推理提示（inline 放在右列）。
  - `PlanContextCard`：补充上下文（时间/人员/方式/节奏）。

---

## 3. 核心交互与验收点（最终 Demo）

### 3.1 必须保留的交互（现已实现）

1. **点击时间轴卡片** → 更新 `focusedCardId` → 右列地图与详情联动
2. **触发风险**（DemoControls 或 AIRequestBox 关键字）→ `RiskWarningBar` 出现
3. **点击“接受建议”** → 进入 `ReplanFlow`（freezing→deconstructing→generating→animating→done）
4. **新卡片飞入**（stagger 80ms）并保留“新”徽章（TTL 后自动移除）
5. **重置演示** → 恢复初始卡片与 UI 状态
6. **自动风险开关** 可用（默认开启）

### 3.2 AIRequestBox（非聊天系统）

AIRequestBox 是“输入新要求”的最小实现：

- suggestion chips 点击 → 只填充 textarea（追加行）
- 点击发送（mock）：
  - 文本包含“累” → 触发 fatigue 风险
  - 文本包含“下雨” → 触发 rain 风险
  - 文本包含“排队”或“人多” → 触发 queue 风险
  - 其它 → 只追加日志：“已收到新要求，等待下一次规划调整。”
- 不显示消息列表，不做多轮对话，不接真实 LLM

---

## 4. 纵向 Timeline（最终形态）

### 4.1 数据结构（保持不变）

时间轴仍使用 `start_minute`、`duration_minutes`、`status` 等字段（详见 `src/types/plan.ts`）。  
区别在于：**不再用 `duration × pixels_per_minute` 计算卡片宽度**；纵向时间轴仅用于排序与展示时间文案。

### 4.2 视觉规则（最终实现）

- 按 `start_minute` 从早到晚排列
- 左侧显示时间点（如 14:00、14:20…）
- 中间竖向连接线 + 节点
- 右侧显示卡片内容
- 状态表达：
  - `active`：更强高亮（边框/环）
  - `risk`：橙色描边与风险文案
  - `done`：显示“已完成”与 ✓
  - `is_new`：蓝色“新”徽章
  - `skipped`：删除线

---

## 5. Replan Flow（最终实现）

ReplanFlow 子阶段（`ReplanPhase`）：

- `freezing`：时间轴整体 `opacity 0.45` + `blur(2px)`
- `deconstructing`：旧卡片飞出（水平右移 + fade + scale）
- `generating`：显示 ReplanOverlay（“AI 正在重新规划...”）并追加日志
- `animating`：新卡片按 inserted 顺序从下方进入（`y:20→0`，`opacity 0→1`，stagger 80ms）
- `done`：回到执行态，更新推理提示，清理 inserted 顺序与风险 UI

**实现入口**：`src/replan/startReplanFlow.ts`  
**常量**：`src/constants/replan.ts`

---

## 6. 状态系统（最终实现）

状态分三层（Context + reducer）：

- **PlanState**：卡片序列、timeline 配置、constraints、planHistory
- **UIState**：focusedCardId、activeRisk、agentMessage、agentLogs、replanPhase、replanInsertedOrder、autoRiskEnabled…
- **MachineState**：严格有限状态（EXECUTING / RISK_DETECTED / REPLANNING 等）

详见 `docs/STATE_MACHINE.md` 与 `src/types/plan.ts`、`src/context/*`。

---

## 7. Demo Controls（最终实现）

`DemoControls`（左列内嵌卡片）提供演示控场能力：

- 模拟排队变长（queue）
- 模拟下雨（rain）
- 模拟孩子累了（fatigue）
- 重置演示（Reset）
- 自动风险：开/关（Auto Risk）

说明：

- DemoControls 是演示入口，不属于“真实产品 UI”，但需要**可见且稳定**。
- 风险触发后会进入 `MachineState: RISK_DETECTED` 并显示 `RiskWarningBar`。

---

## 8. 最终 Demo 流程（推荐讲解脚本，60 秒）

### 8.1 起手（10s）

1. 左列展示当前任务（目标、约束、状态 badge）
2. 中列展示纵向时间轴（done/active/pending）
3. 右列展示地图与聚焦卡片详情

### 8.2 风险触发（10s）

触发方式任选其一：

- 左列「演示控制台」点击“模拟排队变长”
- 或在「与 AI 对话/输入新要求」输入包含“人多/排队”的句子并发送

效果：

- 中列出现 `RiskWarningBar`（橙色高亮）
- 受影响卡片变为 risk 状态（橙色描边）
- 日志追加“风险已触发：排队严重超时”

### 8.3 接受建议 → Replan（20s）

1. 点击 `RiskWarningBar` 的“接受建议”
2. 时间轴 freezing（blur + 透明度）
3. 旧卡片飞出 → overlay generating → 新卡片依次飞入（stagger）
4. 新卡片显示“新”徽章

### 8.4 收尾（20s）

1. 右列推理提示展示：“已缩短高排队活动，并插入低等待替代方案。晚餐与返程时间保持稳定。”
2. 展示 Reset Demo：一键回到初始状态（便于下一轮演示）

