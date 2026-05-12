/** Replan 子阶段时长（毫秒），与 PRD 一致 */
export const REPLAN_PHASE_MS = {
  FREEZING: 200,
  DECONSTRUCTING: 400,
  GENERATING: 800,
  ANIMATING: 600,
  DONE: 200,
} as const;

/** 新卡片依次飞入的间隔（毫秒） */
export const REPLAN_CARD_STAGGER_MS = 80;

/** “新”徽章自动移除延迟（毫秒） */
export const REPLAN_NEW_BADGE_TTL_MS = 3000;

/** Replan 完成后的推理气泡自动隐藏（毫秒） */
export const REPLAN_POST_SUMMARY_HIDE_MS = 3000;

/** 覆盖层淡入淡出（秒，Framer Motion） */
export const REPLAN_OVERLAY_FADE_S = 0.18;

/** 地图在 generating 阶段的 dim 透明度目标 */
export const REPLAN_MAP_DIM_OPACITY = 0.35;

/** 地图路线/点位切换时的淡入（秒） */
export const REPLAN_MAP_ROUTE_FADE_S = 0.28;

/** 新卡片飞入的单卡动画时长（秒） */
export const REPLAN_CARD_ENTER_DURATION_S = 0.35;

/** generating 阶段日志依次追加的步进间隔（毫秒） */
export const REPLAN_GENERATING_LOG_STEP_MS = 200;

/** generating 阶段中心 spinner 旋转周期（毫秒） */
export const REPLAN_SPINNER_PERIOD_MS = 900;

/** freezing 阶段时间轴模糊强度（px） */
export const REPLAN_FREEZING_BLUR_PX = 2;

/** 纵向时间轴 freezing 整体透明度（与横向 0.4 区分，按 Phase6 规范） */
export const REPLAN_VERTICAL_FREEZING_OPACITY = 0.45;

/** 纵向 Replan：旧卡片飞出（相对位移 px） */
export const REPLAN_VERTICAL_EXIT_X = 40;

/** 纵向 Replan：旧卡片飞出缩放 */
export const REPLAN_VERTICAL_EXIT_SCALE = 0.98;

/** 纵向 Replan：新卡片飞入起始偏移（px） */
export const REPLAN_VERTICAL_ENTER_Y = 20;


/** 从流程起点到各阶段结束点的累计时间（毫秒） */
export const REPLAN_T_FREEZING_END = REPLAN_PHASE_MS.FREEZING;
export const REPLAN_T_DECONSTRUCTING_END =
  REPLAN_T_FREEZING_END + REPLAN_PHASE_MS.DECONSTRUCTING;
export const REPLAN_T_GENERATING_END =
  REPLAN_T_DECONSTRUCTING_END + REPLAN_PHASE_MS.GENERATING;
export const REPLAN_T_ANIMATING_END =
  REPLAN_T_GENERATING_END + REPLAN_PHASE_MS.ANIMATING;
export const REPLAN_T_DONE_END = REPLAN_T_ANIMATING_END + REPLAN_PHASE_MS.DONE;

export const REPLAN_GENERATING_LOG_MESSAGES = [
  "正在搜索替代活动...",
  "找到 3 个低排队方案，评估中...",
  "正在保持晚餐时间不变...",
  "已生成局部替换方案",
] as const;

export const REPLAN_POST_SUMMARY_MESSAGE =
  "已缩短高排队活动，并插入低等待替代方案。晚餐与返程时间保持稳定。";

export const REPLAN_GENERATING_OVERLAY_TITLE = "AI 正在重新规划...";
