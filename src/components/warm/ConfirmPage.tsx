import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ACTIONS = [
  "预约亲子乐园",
  "预订餐厅",
  "生成路线",
  "发送给同行人",
  "设置提醒",
] as const;

interface ConfirmPageProps {
  onBackToDashboard: () => void;
  onTryAnother: () => void;
}

export function ConfirmPage({ onBackToDashboard, onTryAnother }: ConfirmPageProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_62%,#FFFDF9_100%)] px-5 py-8 text-[#3C342F]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
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
                key={action}
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
                    <p className="font-semibold">{action}</p>
                    <p className="text-sm text-[#8A7666]">可在真实接入后继续自动完成</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setConfirmed(true)}
              className="rounded-full bg-[#F2A65A] px-7 py-3 text-sm font-bold text-[#3C342F] shadow-[0_14px_32px_rgba(242,166,90,0.32)] hover:bg-[#F6C65B]"
            >
              确认安排
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
        {confirmed ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9] px-5 py-3 text-sm font-semibold text-[#3C342F] shadow-[0_18px_50px_rgba(120,80,40,0.16)]"
          >
            安排已确认，祝你周末玩得开心！
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
