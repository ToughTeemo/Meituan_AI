# Demo 验收清单（Phase 4）

本文档用于黑客松现场：**稳定、可控、可重复**地演示「风险 → 接受建议 → Replan 动画 → 恢复执行」。

---

## 1. 启动方式

在项目根目录执行：

```bash
npm install
npm run dev
```

浏览器打开终端输出的本地地址（一般为 `http://localhost:5173`）。

生产构建自检：

```bash
npm run build
```

---

## 2. 演示路径（推荐顺序）

1. **开场**：页面为三栏驾驶舱；约 5 秒内若 **Auto Risk: On**（默认），会自动触发一次 **排队风险**（也可用手动 Trigger 代替）。
2. **风险出现**：中栏出现 **RiskWarningBar**；左栏风险徽章变化；右栏可能出现 **Agent 推理提示**（与风险相关）。
3. **接受 Replan**：点击 **「接受建议」**（仅此时进入 Replan，不会自动 Replan）。
4. **观察动画链**（约 2.2s 量级，含后续气泡与清徽章定时器）：
   - Timeline **变暗 + blur**（freezing）
   - **受影响且非 done** 的卡片 **飞出**（deconstructing）
   - **覆盖层 spinner** + 文案（generating），**AgentLogBar** 依次追加 4 条日志
   - **新卡片飞入**（animating，带 stagger 与蓝色「新」）
   - **地图**路线/点位 **淡入更新**（无复杂路径动画）
   - 流程结束回到 **EXECUTING**；气泡展示总结句后约 3s 消失；约 3s 后 **「新」徽章**清除

---

## 3. 每一步应该看到什么

| 步骤 | 机器 / UI | 你应看到 |
|------|-----------|----------|
| 自动或手动风险 | `RISK_DETECTED` | RiskWarningBar、受影响卡 `risk` 样式、日志一条「风险已触发」 |
| 点「接受建议」 | `REPLANNING` | 时间轴变暗、飞出、loading、飞入、日志连发、地图更新 |
| 流程结束 | `EXECUTING` | 风险条消失、`replanPhase` 为 idle、可再次 Trigger（在 EXECUTING 且无未处理风险时） |

---

## 4. 如果动画没触发，如何 Reset

1. 鼠标移到左下角 **Demo Controls**（默认半透明，悬停变清晰）。
2. 点击 **「Reset Demo」**。

**Reset 会**：取消所有未完成 Replan 定时器；卡片恢复为 `initialPlan`；机器为 `EXECUTING`；聚焦回到初始 **active** 卡；清空风险 / Replan 阶段 / 气泡；日志恢复为一条初始说明；**不关闭**你当前的 **Auto Risk** 开关（便于继续控场）。

然后按第 2 节从「触发风险」重新走一遍。

---

## 5. 常见问题排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 等不到自动风险 | **Auto Risk: Off** | 打开 **Auto Risk: On**，或用手动 **Trigger Queue** |
| 自动风险只出现一次 | 设计为「每轮会话消费一次自动触发」 | **Reset Demo** 或 **Auto Risk Off → On**（会重置 consumed 标志） |
| 点 Trigger 没反应 | 不在 `EXECUTING`、已有 `activeRisk`、或处于 `REPLANNING` | 看 **AgentLogBar** 里跳过原因；必要时 **Reset Demo** |
| 点「接受建议」没反应 | 不在 `RISK_DETECTED`、`replanPhase` 非 idle、或 Replan 锁占用 | 等当前 Replan 结束或 **Reset Demo** |
| 动画卡在一半 | 浏览器异常或中途状态错乱 | **Reset Demo** 后重来 |
| 连续点 Trigger 日志刷屏 | 已有未处理风险 | 先 **忽略 / 接受**，或 **Reset Demo** |

---

## 6. 稳定性自测（建议上台前跑 3 遍）

1. **Reset Demo** → 完整走 **Trigger → 接受 → 等结束** → 再 **Reset Demo**，重复 **3 次**。
2. 切换 **Auto Risk Off**，确认 **5 秒内不会自动出风险**，只能手动 Trigger。
3. 在 **REPLANNING** 过程中狂点 **Trigger**：日志应提示 **REPLANNING 中不接受**。
4. 在 **REPLANNING** 中狂点 **接受建议**：应被跳过并打日志。
5. 每次 **Reset** 后：时间轴、地图、右栏详情与日志应与「刚加载」一致（除 Auto Risk 开关保持你当前选择外）。

---

## 7. 控场提示

- **只想完全手动**：Auto Risk **Off**，全程用 Trigger。
- **想重复「首次自动风险」**：**Reset Demo** 或 **Auto Risk Off → On**。
