本地生活 AI Agent — Cursor 工程开发 Prompt
第一部分：项目目标说明
项目名称：本地生活 AI Agent — 生活任务驾驶舱
活动背景：美团黑客松 Demo 演示
核心定位：不是聊天机器人，是"生活任务编排与执行"的可视化驾驶舱

产品核心理念：
用户输入一个生活目标（如"周末下午带孩子出去玩"），
AI Agent 自动生成一个带时间轴的任务执行方案，
并在执行过程中监控风险、动态 replan、替换任务卡片。

本项目是纯前端 Demo，不接真实 API，使用 mock 数据驱动所有交互。
演示目标：60 秒内完整展示"生成方案 → 风险触发 → Replan 动画 → 新方案呈现"全流程。
稳定演示 > 功能完整 > 视觉精美。

第二部分：页面结构定义
整个应用是单页应用（SPA），无路由，无多页面。

页面唯一布局：三栏驾驶舱（Dashboard）

┌──────────────────┬────────────────────────────────────┬──────────────────┐
│   左栏            │           中栏                      │    右栏           │
│   约束面板         │           Timeline 主视图            │  地图 + 状态面板   │
│   240px 固定宽     │           flex-1 自适应              │  320px 固定宽      │
│                  │                                    │                  │
│ • 任务目标展示     │ • 时间轴标尺（横向）                  │ • SVG Mock 地图    │
│ • 时间/人员/预算   │ • 任务卡片序列（横向排列）             │ • 路线 + POI 标点  │
│ • 偏好标签        │ • 风险警告条（条件出现）               │ • 聚焦卡片详情     │
│ • 风险状态徽章     │ • Replan 动画蒙层                   │ • 替代方案列表     │
│ • 时间/预算进度条  │ • Agent 操作日志条（底部）            │ • Agent 推理气泡   │
└──────────────────┴────────────────────────────────────┴──────────────────┘

布局规则：
- 三栏全高（100vh），overflow 各自独立管理
- 左栏：不滚动
- 中栏：横向滚动（Timeline 超出时）
- 右栏：纵向滚动（内容超出时）
- 背景色：深色主题（slate-900 / slate-800 层次）

第三部分：组件树定义
App
└── DashboardLayout                   # 三栏 flex 容器，管理整体状态机
    ├── ConstraintPanel               # 左栏
    │   ├── GoalDisplay               # 展示解析后的任务目标
    │   ├── ConstraintList            # 时间窗口 / 人员 / 预算只读展示
    │   ├── PreferenceTags            # 偏好标签（户外/亲子/地铁等）
    │   └── StatusSummary             # 风险徽章 + 时间进度条 + 预算进度条
    │
    ├── TimelinePanel                 # 中栏，核心视图
    │   ├── RiskWarningBar            # 黄色警告条，条件渲染，从顶部滑入
    │   ├── TimelineRuler             # 时间刻度标尺（横向）
    │   ├── CardTrack                 # 卡片轨道容器，横向 flex
    │   │   └── TaskCard × N         # 任务卡片，按 type 渲染不同样式
    │   │       ├── CardHeader        # 类型图标 + 名称 + 状态徽章
    │   │       ├── TimeBar           # 时间段展示 + 进度条（active 时）
    │   │       ├── RiskRow           # 风险提示行，条件渲染
    │   │       └── CardActions       # 操作按钮行（替换/跳过/延长）
    │   ├── ReplanOverlay             # Replan 动画蒙层，AnimatePresence 管理
    │   └── AgentLogBar               # 底部日志条，滚动显示 Agent 操作记录
    │
    └── MapStatusPanel                # 右栏
        ├── MockMapView               # SVG 地图，显示路线和 POI 标点
        ├── CardDetail                # 聚焦卡片的 POI 详情
        │   ├── POIInfo               # 评分 / 营业时间 / 人均 / 排队
        │   └── AlternativeList       # 替代方案列表（可点击替换）
        └── AgentReasoningBubble      # Agent 推理气泡，Replan 时出现

        第四部分：状态管理设计
        技术选型：React useState + useContext + useReducer
不引入 Zustand / Redux，保持零依赖，Demo 足够用。

状态分三层：

━━━ 层 1：Plan 状态（核心业务数据）━━━

interface PlanState {
  cards: Card[]                   // 当前方案卡片序列
  constraints: Constraints        // 约束信息（只读展示）
  planHistory: Card[][]           // 历史方案，支持前后对比
}

Action 类型：
  SET_CARDS         // 初始化 / Replan 后整体替换
  UPDATE_CARD       // 更新单张卡片（状态变化）
  SKIP_CARD         // 跳过某卡片
  PUSH_HISTORY      // 保存当前方案到历史

━━━ 层 2：机器状态（驱动 UI 切换）━━━

type MachineState =
  | 'IDLE'
  | 'EXECUTING'        // 正常执行中
  | 'RISK_DETECTED'    // 风险警告显示
  | 'REPLANNING'       // Replan 动画播放中
  | 'COMPLETED'        // 所有任务完成

单向转换规则（严格）：
  IDLE → EXECUTING
  EXECUTING → RISK_DETECTED（风险触发）
  RISK_DETECTED → REPLANNING（用户确认）
  RISK_DETECTED → EXECUTING（用户忽略）
  REPLANNING → EXECUTING（动画完成）
  EXECUTING → COMPLETED（全部卡片 done）

━━━ 层 3：UI 状态（视图控制）━━━

interface UIState {
  focusedCardId: string | null    // 当前聚焦卡片，驱动右栏内容
  replanPhase: ReplanPhase        // Replan 子阶段，驱动动画时序
  agentMessage: string | null     // Agent 消息，驱动气泡内容
  activeRisk: RiskSignal | null   // 当前活跃风险信号
}

type ReplanPhase =
  | 'idle'
  | 'freezing'          // 200ms，Timeline blur
  | 'deconstructing'    // 400ms，旧卡片飞出
  | 'generating'        // 800ms，loading spinner
  | 'animating'         // 600ms，新卡片飞入
  | 'done'              // 完成，清理状态

Context 结构：
  PlanContext    → 提供 planState + dispatch
  UIContext      → 提供 uiState + setters
  MachineContext → 提供 machineState + send(event)

  第五部分：Timeline 数据结构
  // ━━━ 卡片类型 ━━━
type CardType = 'transit' | 'activity' | 'dining' | 'buffer'

type CardStatus =
  | 'done'       // 已完成，灰色 + 打勾
  | 'active'     // 进行中，绿色 + 进度条
  | 'upcoming'   // 即将开始，蓝色脉冲
  | 'pending'    // 等待，默认灰白
  | 'risk'       // 有风险，黄色边框 + 闪烁
  | 'skipped'    // 已跳过，删除线

interface Card {
  card_id: string
  type: CardType
  status: CardStatus
  label: string              // 显示名称，如 "朝阳公园·儿童乐园"
  emoji: string              // 类型图标，如 "🎠"
  start_minute: number       // 相对于计划开始时间的分钟数，如 0, 25, 115
  duration_minutes: number   // 时长（分钟）
  is_flexible: boolean       // 时长是否可压缩
  is_new?: boolean           // Replan 后新增卡片，显示"新"徽章
  poi?: POI                  // 可选地点信息
  risk_note?: string         // 风险提示文字
  alternatives?: POI[]       // 替代方案列表
}

interface POI {
  poi_id: string
  name: string
  rating: number             // 4.0 ~ 5.0
  price_per_person: number   // 人均消费（元）
  queue_minutes: number      // 当前排队时间
  category: string           // "公园" | "餐厅" | "商场" 等
  map_position: { x: number; y: number }  // SVG 地图坐标（0-100）
  is_child_friendly: boolean
}

interface RiskSignal {
  risk_id: string
  type: 'queue' | 'time' | 'budget' | 'closure'
  severity: 'medium' | 'high'
  title: string              // 简短标题，如 "排队严重超时"
  description: string        // 详细描述
  affected_card_ids: string[]
}

interface Constraints {
  goal: string               // 原始目标文字
  time_start: string         // "14:00"
  time_end: string           // "18:00"
  adults: number
  children: number
  children_age: number
  budget: number             // 总预算（元）
  departure: string          // 出发地名称
  transport_mode: '地铁' | '驾车' | '步行'
  pace: '轻松' | '紧凑'
  preference_tags: string[]  // ["户外", "亲子", "餐饮"]
}

// ━━━ Timeline 布局参数 ━━━
interface TimelineConfig {
  pixels_per_minute: number  // 默认 4px/min，决定卡片宽度
  min_card_width: number     // 最小卡片宽度 80px
  card_height_map: {         // 各类型卡片高度
    transit: 56
    activity: 100
    dining: 100
    buffer: 56
  }
}

// 卡片渲染宽度计算：
// width = Math.max(card.duration_minutes * pixels_per_minute, min_card_width)

第六部分：Replanning 工作流
━━━ 触发条件 ━━━

Demo 中风险由定时器自动触发（不依赖用户操作）：
  - 应用启动后 5 秒，自动触发 RISK_DETECTED
  - 风险类型：排队超时（severity: 'medium'）
  - 受影响卡片：activity 卡片（朝阳公园）

━━━ 完整工作流时序 ━━━

[T+0s]   应用加载，展示初始方案（1 张 done，1 张 active，3 张 pending）
[T+5s]   定时器触发 → MachineState: EXECUTING → RISK_DETECTED
         → activeRisk 写入风险信号
         → activity 卡片 status 变为 'risk'（黄色边框）
         → RiskWarningBar 从顶部滑入（spring 动画）
         → AgentReasoningBubble 出现（右下角）
         → StatusSummary 风险徽章变黄

[用户点击"接受建议"]
         → MachineState: RISK_DETECTED → REPLANNING

━━━ Replan 子阶段时序 ━━━

Phase 1: freezing（200ms）
  → CardTrack 整体 opacity 0.4 + blur(2px)
  → 显示"AI 重新规划中..."覆盖层

Phase 2: deconstructing（400ms）
  → 受影响的卡片（activity + buffer）执行飞出动画
  → animate: { x: 100, opacity: 0 }
  → 已完成的卡片（done 状态）保持不动

Phase 3: generating（800ms）
  → 显示 loading spinner
  → AgentLogBar 滚动显示文字："正在搜索替代活动..."
  → AgentLogBar 继续："找到 3 个方案，评估中..."

Phase 4: animating（600ms）
  → 调用 replaceCards(replanResult.cards)
  → 新卡片从右侧依次飞入
  → animate: { x: -60 → 0, opacity: 0 → 1 }
  → 每张卡片间隔 80ms（stagger）
  → 新增卡片显示蓝色"新"徽章

Phase 5: done（200ms）
  → CardTrack blur 和 opacity 恢复
  → ReplanOverlay 卸载
  → MachineState: REPLANNING → EXECUTING
  → AgentReasoningBubble 更新文字，3 秒后消失

━━━ 单卡替换流程（用户点击"替换"按钮）━━━

  → AlternativeList 选择新 POI
  → 单卡飞出（300ms）→ 新卡飞入（300ms）
  → 不触发全局 Replan
  → AgentLogBar 追加一条记录

  第七部分：Demo 交互脚本
  ━━━ 演示总时长：约 60 秒 ━━━

[0-5s] 开场展示
  画面：三栏驾驶舱满屏展示
  左栏：显示已解析的任务目标和约束
  中栏：Timeline 展示 5 张卡片
        - 卡片1（地铁）：灰色打勾，done
        - 卡片2（朝阳公园）：绿色进度条，active，进度约 60%
        - 卡片3（缓冲）：白色，pending
        - 卡片4（眉州东坡）：白色，pending
        - 卡片5（地铁返回）：白色，pending
  右栏：地图显示路线，POI 标点亮起
  口述要点："这是当前执行中的下午出行方案，已完成出行，正在公园游玩"

[5-15s] 风险自动触发
  画面：黄色 RiskWarningBar 从顶部滑入
        朝阳公园卡片边框变黄，轻微震动
        右下角 AgentReasoningBubble 出现
        左栏风险徽章变黄
  警告文字："朝阳公园热门区域排队 55 分钟，超出计划 35 分钟，后续行程将延误"
  口述要点："AI 实时检测到排队异常，判断影响后续餐饮安排"

[15-20s] 确认 Replan
  操作：演示者点击 RiskWarningBar 上的"接受建议"按钮
  口述要点："一键接受 AI 重新规划"

[20-35s] Replan 动画播放
  画面 Phase 1：Timeline 整体变暗，出现"AI 重新规划中..."
  画面 Phase 2：朝阳公园卡片 + 缓冲卡向右飞出
  画面 Phase 3：spinner + AgentLogBar 滚动文字
  画面 Phase 4：两张新卡片从左依次飞入（带蓝色"新"徽章）
               - "朝阳公园（缩短）45min"
               - "蓝色港湾·室内探索 60min"
  口述要点："AI 自动缩短公园时间，插入室内活动过渡，保持晚餐时间不变"

[35-45s] 新方案展示
  操作：演示者点击新增的"蓝色港湾"卡片
  画面：右栏切换到蓝色港湾详情
        地图路线更新，新 POI 标点出现
        AgentReasoningBubble 显示："室内场馆，无排队，适合 5 岁儿童，不超预算"
  口述要点："点击任意卡片，右侧实时展示地点详情和 AI 推理过程"

[45-60s] 收尾展示
  操作：演示者点击替代方案列表中的另一个餐厅
  画面：餐饮卡单卡替换动画（300ms 飞出飞入）
  左栏：预算进度条实时更新
  口述要点："用户保留完整掌控权，可随时替换任意环节，AI 负责保证整体可行"

  第八部分：开发阶段拆分
  ━━━ Phase 1：静态骨架（目标：能看到完整画面）━━━

任务清单：
  □ Vite + React + TypeScript + Tailwind 项目初始化
  □ DashboardLayout 三栏布局（固定宽度，深色主题）
  □ 写完所有 mock 数据（initialPlan, replanResult, constraints）
  □ ConstraintPanel 静态渲染（展示 mock constraints）
  □ TimelineRuler 静态时间刻度（14:00 到 18:00）
  □ CardTrack 渲染 5 张静态 TaskCard（每种状态各一张）
  □ MockMapView SVG 地图（静态路线 + 5 个 POI 标点）
  □ CardDetail 静态展示第一张卡片的 POI 信息

交付标准：
  打开页面能看到完整的三栏布局和所有静态卡片，无交互。

━━━ Phase 2：状态与交互（目标：能点击，能联动）━━━

任务清单：
  □ 实现 MachineContext + PlanContext + UIContext
  □ TaskCard 点击 → focusedCardId 变化 → 右栏 CardDetail 联动
  □ MockMapView POI 标点随 focusedCardId 高亮联动
  □ StatusSummary 风险徽章 + 进度条动态计算
  □ 实现 useRiskMonitor hook（定时器，5 秒后触发风险）
  □ RiskWarningBar 条件渲染 + Framer Motion 滑入动画
  □ 卡片 status='risk' 样式（黄色边框 + 脉冲）
  □ AgentReasoningBubble 出现动画
  □ "接受建议"按钮触发 MachineState → REPLANNING

交付标准：
  点击卡片右栏联动；5 秒后风险自动出现；点击按钮触发状态转换。

━━━ Phase 3：Replan 动画（目标：核心演示完整可用）━━━

任务清单：
  □ ReplanOverlay 组件（blur 蒙层 + spinner + 文字）
  □ 实现 replanPhase 状态机（5 个子阶段，时序用 setTimeout）
  □ 旧卡片飞出动画（Framer Motion exit: { x: 100, opacity: 0 }）
  □ 新卡片飞入动画（stagger，每张间隔 80ms）
  □ 新卡片"新"徽章渲染（蓝色，3 秒后自动消失）
  □ AgentLogBar 文字滚动（generating 阶段）
  □ 地图路线更新动画（新路线 path 渐入）
  □ 整体联调：完整走一遍 60 秒演示脚本
  □ 修复所有演示中的视觉 bug

交付标准：
  完整走通演示脚本，无卡顿，无报错，动画流畅。

  第九部分：给 Cursor 的严格约束
  ━━━ 产品约束（不可违反）━━━

❌ 不要新增任何页面或路由
❌ 不要做聊天界面（无对话气泡、无消息列表）
❌ 不要做登录/注册/用户系统
❌ 不要接任何真实 API（高德地图、美团、天气等）
❌ 不要新增产品功能（不在文档中的功能一律不做）
❌ 不要用真实地图组件（Mapbox/高德），用 SVG mock

✅ 所有数据来自 src/mock/ 目录下的静态文件
✅ 地图永远是 SVG 手绘示意图
✅ 三栏布局永远固定，不做响应式

━━━ 技术约束 ━━━

❌ 不要引入 Redux / Zustand / MobX（用原生 Context 足够）
❌ 不要引入 React Router（单页，无路由）
❌ 不要引入 XState（状态机手写）
❌ 不要引入 react-query / SWR（无真实请求）
❌ 不要写任何 Node.js / Express 后端代码
❌ 不要写任何数据库相关代码

✅ 技术栈仅限：React + TypeScript + Tailwind + Framer Motion + Vite
✅ shadcn/ui 组件库可以使用（Button、Badge、Progress 等基础组件）
✅ Framer Motion 是唯一动画库

━━━ Timeline 核心约束 ━━━

✅ Timeline 是整个产品的核心视图，必须在中栏始终可见
✅ 卡片宽度由 duration_minutes × pixels_per_minute 计算，不要写死
✅ 卡片状态变化必须有视觉反馈（颜色、边框、图标）
✅ Replan 动画必须流畅，是演示的核心高光时刻
❌ 不要把 Timeline 做成列表（竖向排列是错的，必须横向）
❌ 不要删减卡片类型（transit / activity / dining / buffer 四种都要）

━━━ 代码质量约束 ━━━

✅ 所有组件用函数式组件 + Hooks
✅ 所有 props 必须有 TypeScript 类型定义
✅ mock 数据统一放在 src/mock/，组件不要内联硬编码数据
✅ 动画时序用具名常量定义（如 REPLAN_PHASE_DURATION），不要写魔法数字
❌ 不要用 any 类型
❌ 不要在组件里直接 setTimeout，封装到 hooks 里

━━━ 演示稳定性约束 ━━━

✅ Demo 演示脚本（见第七部分）是最高优先级，所有开发围绕它
✅ Phase 1、2、3 顺序开发，每个 Phase 完成后必须能稳定运行再进入下一个
✅ 如果某个功能影响演示稳定性，砍掉该功能而不是修 bug
✅ Replan 动画必须在所有 Chrome / Edge 现代浏览器上流畅运行
❌ 不要因为"扩展性"或"最佳实践"增加任何演示不需要的复杂度
❌ Phase 3 完成前不要做任何 Nice to Have 功能