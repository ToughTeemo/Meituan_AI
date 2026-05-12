# ARCHITECTURE（工程架构说明）

本项目是**纯前端单页 Demo**，通过 mock 数据 + 状态机驱动“生成方案 → 风险 → Replan 动画 → 新方案呈现”全流程。

## 1. 技术栈

- **React 19 + TypeScript**
- **Vite** 构建
- **TailwindCSS** 深色 UI
- **Framer Motion** 动画（Replan、卡片入场、风险强调等）

脚本（见 `package.json`）：

- `npm run dev`
- `npm run build`（必须通过）
- `npm run preview`

---

## 2. `src/` 目录结构（按职责）

> 以当前仓库实际文件为准（核心文件列举，非穷举）。

### 2.1 入口与全局

- `src/main.tsx`：挂载 React
- `src/App.tsx`：包裹 `DashboardProviders` + `DashboardLayout`
- `src/index.css`：全局样式（Tailwind）

### 2.2 布局与核心组件（三列）

- `src/components/DashboardLayout.tsx`：单页根布局（含横向最小宽与溢出处理）
- `src/components/ThreeColumnWorkspace.tsx`：三列并排（左 380 / 中 flex / 右 400）
- `src/components/LeftMissionColumn.tsx`：左列容器（列内滚动 + 底部控制台）
- `src/components/CenterTimelineColumn.tsx`：中列容器（标题/阶段/风险条/时间轴/日志）
- `src/components/RightMapColumn.tsx`：右列容器

### 2.3 左列：任务与输入（非聊天）

- `src/components/MissionInputCard.tsx`：当前任务卡（只读 + mock 按钮）
- `src/components/AIRequestBox.tsx`：输入新要求（chips + textarea + 发送 mock）
- `src/components/DemoControls.tsx`：演示控制台（触发风险/重置/自动风险开关）

### 2.4 中列：纵向时间轴与 Replan 动画

- `src/components/VerticalTimelinePanel.tsx`：纵向轨道 + ReplanOverlay + freezing blur/opacity
- `src/components/VerticalTaskCard.tsx`：卡片行（左时间 + 中节点线 + 右卡片）
- `src/components/RiskWarningBar.tsx`：风险提示条（接受建议/忽略）
- `src/components/ReplanOverlay.tsx`：Replan generating 阶段覆盖层
- `src/components/AgentLogBar.tsx`：底部执行日志（非对话）

### 2.5 右列：地图与详情

- `src/components/MapStatusPanel.tsx`：右列总面板（地图、聚焦、替代、推理、上下文）
- `src/components/MockMapView.tsx`：SVG 示意地图（路线 + POI + 高亮）
- `src/components/CardDetail.tsx`：聚焦卡片详情（含导出 `AlternativesPanel`）
- `src/components/AgentReasoningBubble.tsx`：推理提示（inline / floating 兼容）
- `src/components/PlanContextCard.tsx`：上下文补充卡片

### 2.6 状态与业务

#### Context（单向数据流）

- `src/context/PlanContext.tsx` + `src/context/planReducer.ts`
  - **PlanState**：`cards / timeline / constraints / planHistory`
  - 负责“方案数据”的增删改（Replan 结果写入也通过这里）
- `src/context/UIContext.tsx` + `src/context/uiReducer.ts`
  - **UIState**：`focusedCardId / activeRisk / agentMessage / agentLogs / replanPhase / replanInsertedOrder / autoRiskEnabled ...`
  - 负责“视图控制与日志”
- `src/context/MachineContext.tsx` + `src/context/machineReducer.ts`
  - **MachineState**：`IDLE | EXECUTING | RISK_DETECTED | REPLANNING | COMPLETED`
  - 严格有限状态，避免 UI 乱跳
- `src/context/DashboardProviders.tsx`
  - 统一挂载三 Context，并在内部挂载 `RiskRuntime`

#### Hooks（封装交互与副作用）

- `src/hooks/useDashboardRiskActions.ts`
  - 统一封装“触发风险 / 接受建议 / 忽略 / reset”等动作
  - 负责 Replan 锁、防重复触发、cancel 逻辑
- `src/hooks/useRiskMonitor.ts`
  - 自动风险（Auto Risk）监控：开关、延迟触发、消费标记等

#### Replan Flow（关键：不改状态机，只驱动 UI 子阶段）

- `src/replan/startReplanFlow.ts`
  - 通过 `setTimeout` 串起子阶段
  - 写入：`ui.replanPhase`、`ui.replanInsertedOrder`、`plan.cards`、`ui.agentMessage`、`machine` 事件
- `src/constants/replan.ts`
  - 阶段时长、overlay 文案、stagger、freezing blur/opacity、纵向 enter/exit 偏移等

---

## 3. Mock 数据结构与来源

### 3.1 初始方案

- `src/mock/initialPlan.ts`：初始 `cards` + `timeline` 配置（包含 POI 与替代方案）
- `src/mock/constraints.ts`：初始约束（goal、时间窗、预算、出发地、人员等）
- `src/mock/index.ts`：统一导出

### 3.2 风险与 Demo 触发

- `src/mock/riskPresets.ts`
  - 风险信号构造：queue / rain / fatigue
  - `agentMessageForRisk`：风险出现时的推理提示文案
  - `resolveAffectedCardIds`：根据当前卡片，决定受影响卡片集合

### 3.3 本地 replan 片段合成（无模型）

- `src/mock/localReplan.ts`
  - 将“某段替换”合并回当前 cards（保持时间窗可容纳）
- `src/mock/replanResult.ts`、`src/mock/statusSummary.ts`
  - 演示用预置片段与辅助数据（按当前仓库实际使用情况）

---

## 4. 组件职责边界（协作约定）

### 4.1 组件“只负责展示”的原则

- `MissionInputCard`：展示 constraints（不接 LLM，不写真实生成逻辑）
- `AIRequestBox`：只做输入与简单关键字触发（不做消息列表）
- `MockMapView`：纯 SVG 示意（不接真实地图）

### 4.2 “动作入口”统一收敛到 hook

- 风险触发 / 接受建议 / 忽略 / reset：统一通过 `useDashboardRiskActions`
- 自动风险：通过 `useRiskMonitor`（`RiskRuntime` 中挂载）

---

## 5. 状态流转（高层）

1. `MachineProvider` 启动后 `BOOT` → `EXECUTING`
2. `RiskRuntime`（自动）或 `DemoControls/AIRequestBox`（手动）触发风险
3. `RiskWarningBar` 提示 → 接受建议进入 `REPLANNING`
4. `startReplanFlow` 逐阶段推进（UI 子阶段），最终 `REPLAN_DONE` 回到 `EXECUTING`

详细状态机见 `docs/STATE_MACHINE.md`。

