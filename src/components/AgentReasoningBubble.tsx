import { AnimatePresence, motion } from "framer-motion";

interface AgentReasoningBubbleProps {
  message: string | null;
  /** inline：嵌入右栏文档流；floating：旧版右下角悬浮（保留兼容） */
  variant?: "inline" | "floating";
}

export function AgentReasoningBubble({
  message,
  variant = "inline",
}: AgentReasoningBubbleProps) {
  const wrapClass =
    variant === "floating"
      ? "pointer-events-none absolute bottom-2 right-2 z-10 w-[min(100%,260px)]"
      : "w-full";

  const bubbleClass =
    variant === "floating"
      ? "rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-[11px] leading-snug text-slate-100 shadow-lg backdrop-blur"
      : "rounded-xl border border-sky-900/40 bg-slate-900/80 px-3 py-2.5 text-[11px] leading-snug text-slate-100 shadow-inner";

  return (
    <div className={wrapClass}>
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 34,
              mass: 0.7,
            }}
            className={bubbleClass}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
              Agent 推理提示
            </p>
            <p className="mt-1 text-slate-100">{message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!message ? (
        <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-600">
          暂无新的推理提示
        </p>
      ) : null}
    </div>
  );
}
