import { motion } from "framer-motion";

const DEFAULT_PROMPT =
  "今天下午带老婆和5岁孩子出去玩，不想太累，预算500，最好别排队，晚上8点前回家";

const STEPS = [
  {
    title: "理解需求",
    description: "识别到 2 位成人 · 1 位 5 岁儿童，预算 ¥500，不想太累",
    state: "done",
  },
  {
    title: "规划活动节奏",
    description: "优先安排轻松节奏，减少换乘和长时间步行",
    state: "done",
  },
  {
    title: "匹配附近商户",
    description: "筛选亲子友好、可预约、排队较少的地点",
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

const TAGS = ["时间 14:00-20:00", "2大1小", "预算500", "轻松", "不排队", "亲子友好"];

interface PlanningPageProps {
  prompt: string;
  onBack: () => void;
  onViewPlan: () => void;
}

export function PlanningPage({ prompt, onBack, onViewPlan }: PlanningPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_58%,#FFFDF9_100%)] px-5 py-6 text-[#3C342F]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <button
          type="button"
          onClick={onBack}
          className="w-fit rounded-full border border-[rgba(120,90,60,0.12)] bg-white/60 px-4 py-2 text-sm font-semibold text-[#6E6259] hover:bg-white"
        >
          返回首页
        </button>

        <section className="flex flex-1 items-center justify-center py-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl rounded-[2rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/92 p-6 shadow-[0_22px_58px_rgba(120,80,40,0.12)] sm:p-8"
          >
            <p className="text-sm font-semibold text-[#8A5A2F]">AI 正在为你安排周末</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">先把轻松感排进路线里</h1>
            <p className="mt-4 rounded-3xl bg-[#F7EEDF] px-4 py-3 text-sm leading-6 text-[#6E6259]">
              {prompt.trim() || DEFAULT_PROMPT}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {TAGS.map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.05 }}
                  className="rounded-full border border-[rgba(120,90,60,0.10)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#6E6259]"
                >
                  {tag}
                </motion.span>
              ))}
            </div>

            <div className="mt-7 space-y-3">
              {STEPS.map((step, index) => {
                const isCurrent = step.state === "current";
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 + index * 0.14, duration: 0.35 }}
                    className={
                      isCurrent
                        ? "flex items-center gap-3 rounded-3xl border border-[#F2A65A]/24 bg-[#FFF4DE] p-4 shadow-[0_12px_30px_rgba(120,80,40,0.09)]"
                        : "flex items-center gap-3 rounded-3xl border border-[rgba(120,90,60,0.08)] bg-white/56 p-4"
                    }
                  >
                    <motion.span
                      initial={{ scale: 0.8, backgroundColor: "#F7EEDF" }}
                      animate={{ scale: 1, backgroundColor: isCurrent ? "#F6C65B" : "#B7C9A8" }}
                      transition={{ delay: 0.34 + index * 0.14 }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#3C342F]"
                    >
                      {isCurrent ? "…" : "✓"}
                    </motion.span>
                    <div>
                      <p className={isCurrent ? "font-bold text-[#3C342F]" : "font-semibold text-[#5F5148]"}>
                        {step.title}
                      </p>
                      <p className="text-sm leading-6 text-[#8A7666]">{step.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onViewPlan}
                className="rounded-full bg-[#F2A65A] px-7 py-3 text-sm font-bold text-[#3C342F] shadow-[0_14px_32px_rgba(242,166,90,0.32)] hover:bg-[#F6C65B]"
              >
                查看我的周末方案
              </motion.button>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
