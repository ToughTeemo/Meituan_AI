import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  confirmPlan,
  runPlanAction,
  type PlanActionType,
} from "@/api/plans";

const ACTIONS: { label: string; type: PlanActionType }[] = [
  { label: "预约亲子乐园", type: "reserve_activity" },
  { label: "预订餐厅", type: "reserve_restaurant" },
  { label: "生成路线", type: "generate_route" },
  { label: "发送给同行人", type: "share_plan" },
  { label: "设置提醒", type: "set_reminder" },
];

interface ConfirmPageProps {
  planId: string | null;
  onBackToDashboard: () => void;
  onTryAnother: () => void;
}

export function ConfirmPage({
  planId,
  onBackToDashboard,
  onTryAnother,
}: ConfirmPageProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!planId) {
      setConfirmed(true);
      setToast("安排已确认，当前为本地演示结果。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmPlan(planId);
      setConfirmed(true);
      setToast(result.agent_logs[0]?.message ?? "安排已确认。");
    } catch (error) {
      console.warn("Confirm failed.", error);
      setToast("确认失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (actionType: PlanActionType) => {
    if (!planId) {
      setToast("已执行演示动作。");
      return;
    }

    try {
      const result = await runPlanAction({ planId, actionType });
      setToast(result.message);
    } catch (error) {
      console.warn("Action failed.", error);
      setToast("动作执行失败，请稍后重试。");
    }
  };

  return (
    <main className="h-dvh overflow-y-auto overflow-x-hidden bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_62%,#FFFDF9_100%)] px-5 py-8 text-[#3C342F]">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-[2rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/92 p-6 shadow-[0_24px_70px_rgba(120,80,40,0.13)] sm:p-8"
        >
          <p className="text-sm font-semibold text-[#B46C3D]">执行确认</p>
          <h1 className="mt-2 text-4xl font-bold">已经帮你安排好了</h1>
          <p className="mt-3 text-[#6E6259]">下面这些事情可以一键交给 AI 继续完成</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((action, index) => (
              <motion.div
                key={action.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="rounded-3xl border border-[rgba(120,90,60,0.10)] bg-white/72 p-4 shadow-[0_10px_30px_rgba(120,80,40,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6C65B]/80 font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className="text-sm text-[#8A7666]">可在真实接入后继续自动完成</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAction(action.type)}
                  className="mt-3 rounded-full border border-[rgba(120,90,60,0.12)] bg-white/70 px-3 py-1.5 text-[11px] font-bold text-[#6E6259] hover:bg-white"
                >
                  执行此项
                </button>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
              className="rounded-full bg-[#F2A65A] px-7 py-3 text-sm font-bold text-[#3C342F] shadow-[0_14px_32px_rgba(242,166,90,0.32)] hover:bg-[#F6C65B]"
            >
              {isSubmitting ? "正在确认…" : "确认安排"}
            </motion.button>
            <button
              type="button"
              onClick={onTryAnother}
              className="rounded-full border border-[rgba(120,90,60,0.14)] bg-white/70 px-5 py-3 text-sm font-bold text-[#6E6259] hover:bg-white"
            >
              换一个方案
            </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="rounded-full border border-[rgba(120,90,60,0.14)] bg-white/70 px-5 py-3 text-sm font-bold text-[#6E6259] hover:bg-white"
            >
              发送给同行人确认
            </button>
          </div>
        </motion.div>
      </section>

      <AnimatePresence>
        {confirmed || toast ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9] px-5 py-3 text-sm font-semibold text-[#3C342F] shadow-[0_18px_50px_rgba(120,80,40,0.16)]"
          >
            {toast ?? "安排已确认，祝你周末玩得开心！"}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
