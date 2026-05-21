import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppTopNav } from "@/components/AppTopNav";

const DEFAULT_PROMPT =
  "今天下午带孩子出去玩，不想太累，预算500，晚上8点前回家";

const STEPS = [
  {
    title: "理解需求",
    description: "已识别人数、预算、时间和偏好",
    state: "done",
  },
  {
    title: "规划活动节奏",
    description: "优先安排轻松节奏，减少长时间步行",
    state: "done",
  },
  {
    title: "匹配附近商户",
    description: "正在筛选亲子友好、可预约、少排队地点",
    state: "done",
  },
  {
    title: "检查预算和时间",
    description: "控制在 ¥500 内，并确保 20:00 前到家",
    state: "done",
  },
  {
    title: "生成方案",
    description: "正在整理成可查看、可调整的周末路线",
    state: "current",
  },
] as const;

type StepState = "done" | "current";

const TAGS = [
  "时间 14:00-20:00",
  "2大1小",
  "预算500",
  "轻松",
  "不排队",
  "亲子友好",
] as const;

interface PlanningPageProps {
  prompt: string;
  onBack: () => void;
  onViewPlan: () => void;
  planReady?: boolean;
  fallbackNotice?: boolean;
}

function StatusIcon({ state, index }: { state: StepState; index: number }) {
  if (state === "current") {
    return (
      <motion.span
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6C65B] text-sm font-bold text-[#3C342F] shadow-[0_0_0_5px_rgba(246,198,91,0.16)]"
      >
        …
      </motion.span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.78 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.18 + index * 0.08, type: "spring", stiffness: 520, damping: 28 }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF5E9] text-sm font-bold text-[#526849]"
    >
      ✓
    </motion.span>
  );
}

function ProgressSummary({ isGenerated }: { isGenerated: boolean }) {
  return (
    <section className="mt-4 rounded-[1.25rem] border border-[rgba(120,90,60,0.08)] bg-[#FFF9F2]/70 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#5F5148]">
          {isGenerated ? "已完成 5 / 5 步，方案已生成" : "已完成 4 / 5 步，正在生成最终路线"}
        </p>
        <span className="rounded-full bg-[#FFF4DE] px-3 py-1 text-[11px] font-bold text-[#8A5A2F]">
          {isGenerated ? "100%" : "80%"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F1E5D5]">
        <motion.div
          initial={{ width: "42%" }}
          animate={{ width: isGenerated ? "100%" : "80%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative h-full rounded-full bg-[#F2A65A]"
        >
          {!isGenerated ? (
            <motion.span
              aria-hidden="true"
              animate={{ x: ["-30%", "120%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

export function PlanningPage({
  prompt,
  onBack,
  onViewPlan,
  planReady = true,
  fallbackNotice = false,
}: PlanningPageProps) {
  const displayPrompt = prompt.trim() || DEFAULT_PROMPT;
  const [isGenerated, setIsGenerated] = useState(false);

  useEffect(() => {
    setIsGenerated(false);
    const timer = window.setTimeout(() => {
      setIsGenerated(true);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [prompt]);

  const canViewPlan = isGenerated && planReady;

  return (
    <main className="relative h-dvh overflow-y-auto overflow-x-hidden bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_58%,#FFFDF9_100%)] text-[#3C342F]">
      <div className="pointer-events-none absolute left-[12%] top-[10%] h-72 w-72 rounded-full bg-[#F6C65B]/16 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-[14%] h-72 w-72 rounded-full bg-[#EE8F6A]/12 blur-3xl" />

      <div className="relative z-30">
        <AppTopNav showBack onBack={onBack} onHomeClick={onBack} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-76px)] w-full max-w-[1220px] flex-col px-5 py-4">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: "easeOut" }}
          className="rounded-[2.15rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/94 px-7 py-6 shadow-[0_20px_48px_rgba(120,80,40,0.09)] backdrop-blur sm:px-9 xl:px-12"
        >
          <header className="text-center">
            <p className="text-xs font-semibold text-[#8A5A2F]">
              AI 正在为你安排周末
            </p>
            <h1 className="mt-1.5 text-[28px] font-bold leading-tight text-[#2F2925]">
              正在生成一条少排队、轻松可执行的路线
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-[#7B6E63]">
              正在综合时间、预算、距离、排队和返程安排
            </p>
          </header>

          <section className="mt-4">
            <div className="flex min-h-[56px] items-center rounded-[1.35rem] bg-[#F7EEDF]/68 px-5 py-2.5 text-sm leading-6 text-[#6E6259]">
              “{displayPrompt}”
            </div>
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              {TAGS.map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.04 }}
                  className="rounded-full border border-[rgba(120,90,60,0.10)] bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-[#6E6259]"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </section>

          <ProgressSummary isGenerated={canViewPlan} />

          {fallbackNotice ? (
            <p className="mt-3 rounded-full bg-[#FFF4DE] px-4 py-2 text-center text-xs font-semibold text-[#8A5A2F]">
              已切换到本地演示数据
            </p>
          ) : null}

          <section className="mt-4 flex flex-col gap-3">
            {STEPS.map((step, index) => {
              const state: StepState =
                step.state === "current" && canViewPlan ? "done" : step.state;
              const isCurrent = state === "current";
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 + index * 0.09, duration: 0.34 }}
                  className={
                    isCurrent
                      ? "flex min-h-[78px] items-center gap-4 rounded-[1.35rem] border border-[#F2A65A]/28 bg-[#FFF3DC] px-4 py-2.5 shadow-[0_8px_20px_rgba(120,80,40,0.07)]"
                      : "flex min-h-[78px] items-center gap-4 rounded-[1.35rem] border border-[rgba(120,90,60,0.08)] bg-white/62 px-4 py-2.5"
                  }
                >
                  <StatusIcon state={state} index={index} />
                  <div className="min-w-0 flex-1">
                    <p className={isCurrent ? "font-bold text-[#3C342F]" : "font-semibold text-[#5F5148]"}>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-5 text-[#8A7666]">
                      {step.description}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full bg-[#F6C65B]/42 px-3 py-1 text-[11px] font-bold text-[#8A5A2F]">
                      进行中
                    </span>
                  ) : null}
                </motion.div>
              );
            })}
          </section>

          <footer className="mt-4 flex items-center justify-between gap-4 rounded-[1.35rem] border border-[rgba(120,90,60,0.08)] bg-[#FFF9F2]/72 px-5 py-3">
            <p className="text-sm leading-6 text-[#6E6259]">
              {isGenerated
                ? planReady
                  ? "方案已经生成，可以查看完整的周末路线。"
                  : "方案已整理完成，正在同步路线数据。"
                : "方案即将生成，正在检查排队、预算和返程时间。"}
            </p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!canViewPlan}
              onClick={() => {
                if (canViewPlan) onViewPlan();
              }}
              className={
                canViewPlan
                  ? "shrink-0 rounded-full bg-[#F2A65A] px-7 py-3 text-sm font-bold text-[#3C342F] shadow-[0_14px_32px_rgba(242,166,90,0.30)] transition hover:bg-[#F6C65B]"
                  : "shrink-0 cursor-not-allowed rounded-full bg-[#F7EEDF] px-7 py-3 text-sm font-bold text-[#9A8575] shadow-none"
              }
            >
              {canViewPlan ? "查看我的周末方案" : "正在生成方案…"}
            </motion.button>
          </footer>
        </motion.section>
      </div>
    </main>
  );
}
