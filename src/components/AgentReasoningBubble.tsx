import { AnimatePresence, motion } from "framer-motion";

interface AgentReasoningBubbleProps {
  message: string | null;
  variant?: "inline" | "floating";
}

export function AgentReasoningBubble({
  message,
  variant = "inline",
}: AgentReasoningBubbleProps) {
  if (!message) return null;

  const wrapClass =
    variant === "floating"
      ? "pointer-events-none absolute bottom-2 right-2 z-10 w-[min(100%,260px)]"
      : "w-full";

  const bubbleClass =
    variant === "floating"
      ? "rounded-[1.35rem] border border-[rgba(120,90,60,0.14)] bg-[#FFFDF9]/92 px-4 py-3 text-[11px] leading-snug text-[#3C342F] shadow-[0_18px_44px_rgba(120,80,40,0.14)] backdrop-blur"
      : "rounded-[1.35rem] border border-[#F2A65A]/18 bg-[#FFF4DE] px-4 py-3 text-[11px] leading-snug text-[#3C342F] shadow-[0_12px_32px_rgba(120,80,40,0.08)]";

  return (
    <div className={wrapClass}>
      <AnimatePresence mode="wait">
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
          className={bubbleClass}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A5A2F]">
            小助手提示
          </p>
          <p className="mt-1 text-[#5F5148]">{message}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
