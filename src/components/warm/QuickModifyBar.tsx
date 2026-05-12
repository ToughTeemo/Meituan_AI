import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";

const OPTIONS = ["别走太远", "预算再省点", "换个室内点", "尽量少排队", "晚餐清淡点"] as const;

export function QuickModifyBar() {
  const { dispatch } = useUI();

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      {OPTIONS.map((option) => (
        <motion.button
          key={option}
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            dispatch({
              type: "APPEND_LOG",
              message: `收到：${option}。我会优先选择更贴合这个偏好的安排。`,
            })
          }
          className="rounded-full border border-[rgba(120,90,60,0.10)] bg-white/62 px-3 py-1.5 text-xs font-medium text-[#6E6259] shadow-[0_5px_14px_rgba(120,80,40,0.04)] transition hover:bg-[#FFF4DE]"
        >
          {option}
        </motion.button>
      ))}
    </div>
  );
}
