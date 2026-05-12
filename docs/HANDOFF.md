# HANDOFF（团队交接与维护指南）

## 1. 快速开始

### 1.1 安装依赖

```bash
npm install
```

### 1.2 启动开发

```bash
npm run dev
```

### 1.3 生产构建（必须通过）

```bash
npm run build
```

---

## 2. Demo 使用手册（给演示同学）

### 2.1 一键重置

- 左列 **演示控制台** 点击 **“重置演示”**
- 效果：
  - `PlanState.cards` 恢复为 `src/mock/initialPlan.ts`
  - `UIState` 恢复初始（focusedCardId、日志、风险 UI 清空、AutoRisk 重新可触发）
  - `MachineState` 回到 `EXECUTING`

实现入口：`src/hooks/useDashboardRiskActions.ts` → `resetDemo`

### 2.2 如何触发风险（3 种）

#### A. DemoControls（推荐）

- “模拟排队变长” → queue
- “模拟下雨” → rain
- “模拟孩子累了” → fatigue

#### B. AIRequestBox（输入关键字触发）

在左列 **“与 AI 对话 / 输入新要求”** 输入并发送：

- 包含“累” → fatigue
- 包含“下雨” → rain
- 包含“排队”或“人多” → queue
- 其它 → 只追加日志（不触发风险）

#### C. Auto Risk（自动风险）

- Auto Risk 默认开启
- 延迟触发时间在 `src/mock/riskPresets.ts` 的 `RISK_AUTO_DELAY_MS`

### 2.3 接受建议（进入 Replan）

中列 `RiskWarningBar` 点击 **“接受建议”**：

- 进入 `MachineState = REPLANNING`
- 触发 `startReplanFlow` 逐阶段动画（freezing→deconstructing→generating→animating→done）
- 新卡片带“新”徽章（TTL 后自动移除）

---

## 3. 哪些文件不要随便改（高风险区）

### 3.1 状态机与流程

- `src/context/machineReducer.ts`：MachineState 转换规则（改错会导致流程断裂）
- `src/replan/startReplanFlow.ts`：Replan 生命周期编排（时序、inserted order、清理逻辑）
- `src/hooks/useDashboardRiskActions.ts`：统一动作入口（锁、防重复、cancel）

### 3.2 Mock 数据（改动会影响演示稳定性）

- `src/mock/initialPlan.ts`：初始卡片序列（POI、替代方案、risk_note）
- `src/mock/constraints.ts`：任务约束来源（MissionInputCard 直接读取）
- `src/mock/localReplan.ts`：本地 replan 片段合并（时间窗容纳逻辑）

### 3.3 动画常量

- `src/constants/replan.ts`：Replan 时序、stagger、overlay 文案、freezing blur/opacity、纵向入场/退场偏移

---

## 4. Replan 动画在哪改？

### 4.1 生命周期编排（时间点）

- `src/replan/startReplanFlow.ts`
  - `SET_REPLAN_PHASE` 推进子阶段
  - `SET_CARDS` 替换 cards
  - `SET_REPLAN_INSERTED_ORDER` 控制新卡 stagger 顺序

### 4.2 视觉动效（位移/透明度/缩放）

- `src/components/VerticalTimelinePanel.tsx`
  - freezing：blur/opacity（整体）
  - overlay：`ReplanOverlay`
- `src/components/VerticalTaskCard.tsx`
  - 旧卡 exit（x/opacity/scale）
  - 新卡 enter（y/opacity + stagger）
- 常量：`src/constants/replan.ts`

---

## 5. 如何新增一种 mock 风险？

目标：**不接真实 API**，仅增加一个演示用风险。

1. 在 `src/mock/riskPresets.ts`
   - 增加 `DemoRiskTrigger` 枚举值（例如 `"closure"`）
   - 增加 `createXxxRiskSignal`（title/description/affected_card_ids）
   - 在 `createRiskSignalForDemoTrigger` 增加 case
   - 在 `agentMessageForRisk` 增加 case（推理提示文案）
2. 在 `src/hooks/useDashboardRiskActions.ts`
   - 不需要改主流程；`triggerDemoRisk(trigger)` 会走同一套 OPEN_RISK 与状态机逻辑
3. 在 `src/components/DemoControls.tsx`（可选）
   - 增加一个按钮触发新 trigger

注意：

- `MachineState` 必须仍遵守 `EXECUTING → RISK_DETECTED → REPLANNING → EXECUTING`
- 风险描述请保持“评委一眼看懂”的中文

---

## 6. 如何修改 timeline 卡片（样式/字段）

### 6.1 卡片展示与状态样式

- `src/components/VerticalTaskCard.tsx`
  - `statusClasses`：risk/active/done 等视觉
  - 时间文案：`formatClockFromStart(planStart, start_minute)`

### 6.2 排序与时间轴结构

- `src/components/VerticalTimelinePanel.tsx`
  - 仅按 `start_minute` 排序渲染（纵向）
  - ReplanOverlay 与 freezing 在这里整体控制

### 6.3 数据字段

- `src/types/plan.ts`：`Card` / `POI` / `RiskSignal` 类型定义
- `src/mock/initialPlan.ts`：具体卡片数据（risk_note、alternatives、poi）

