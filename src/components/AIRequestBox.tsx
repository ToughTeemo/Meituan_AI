import { useState } from "react";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";

const QUICK_INPUTS = [
  {
    label: "孩子有点累了",
    tone: "preference",
    message: "收到：孩子有点累了。我会优先安排更近、更轻松的休息点。",
    risk: "fatigue" as const,
  },
  {
    label: "晚餐想早点吃",
    tone: "preference",
    message: "收到：晚餐想早点吃。我会优先保留更早的用餐窗口。",
  },
  {
    label: "预算再省一点",
    tone: "preference",
    message: "收到：预算再省一点。我会优先选择更高性价比的地点。",
  },
  {
    label: "避开人多的地方",
    tone: "preference",
    message: "收到：避开人多的地方。我会优先选择等待时间更短的地点。",
  },
  { label: "排队变长", tone: "situation", risk: "queue" as const },
  { label: "突然下雨", tone: "situation", risk: "rain" as const },
  {
    label: "餐厅没位",
    tone: "situation",
    message: "收到：餐厅没位。我会优先帮你找附近可预约、适合亲子的餐厅。",
  },
  {
    label: "路上拥堵",
    tone: "situation",
    message: "收到：路上拥堵。我会优先选择更少换乘、耗时更稳定的路线。",
  },
] as const;

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function AIRequestBox() {
  const [text, setText] = useState("");
  const { dispatch: uiDispatch } = useUI();
  const { triggerDemoRisk } = useDashboardRiskActions();

  const appendLog = (message: string) => {
    uiDispatch({ type: "APPEND_LOG", message });
  };

  const applyQuickInput = (item: (typeof QUICK_INPUTS)[number]) => {
    setText(item.label);
    if ("risk" in item && item.risk) {
      triggerDemoRisk(item.risk);
      return;
    }
    appendLog(item.message);
  };

  const handleSend = () => {
    const next = text.trim();
    if (!next) {
      appendLog("可以直接告诉我新的想法或新的情况，我会帮你微调安排。");
      return;
    }

    if (next.includes("累")) {
      triggerDemoRisk("fatigue");
    } else if (next.includes("下雨") || next.includes("室内")) {
      triggerDemoRisk("rain");
    } else if (next.includes("排队") || next.includes("人多")) {
      triggerDemoRisk("queue");
    } else if (next.includes("没位") || next.includes("餐厅")) {
      appendLog("收到：餐厅相关变化。我会优先帮你找附近可预约、适合亲子的餐厅。");
    } else if (next.includes("堵") || next.includes("拥堵")) {
      appendLog("收到：路上拥堵。我会优先选择更少换乘、耗时更稳定的路线。");
    } else {
      appendLog(`收到：${next}。我会按这个偏好帮你微调安排。`);
    }
    setText("");
  };

  const handleVoice = () => {
    appendLog("语音输入已收到，我会按你的新想法继续微调安排。");
  };

  return (
    <section className="rounded-[1.65rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] p-4 shadow-[0_10px_26px_rgba(120,80,40,0.055)]">
      <div>
        <p className="text-xs font-bold text-[#8A5A2F]">和 AI 继续说</p>
        <p className="mt-1 text-[12px] leading-5 text-[#8A7666]">
          有新的想法或新的情况，都可以直接告诉我。
        </p>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold text-[#6E6259]">
          你也可以快速补充：
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_INPUTS.map((item) => (
            <motion.button
              key={item.label}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => applyQuickInput(item)}
              className={
                item.tone === "situation"
                  ? "rounded-full border border-[#B7C9A8]/28 bg-[#EFF5E9]/64 px-3 py-1.5 text-[11px] font-medium text-[#526849] transition hover:bg-[#E6F0DF]"
                  : "rounded-full border border-[rgba(120,90,60,0.10)] bg-[#F7EEDF]/62 px-3 py-1.5 text-[11px] font-medium text-[#6E6259] transition hover:bg-[#FFF4DE]"
              }
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="比如：孩子有点累了，想找个室内休息点，别走太远。"
          className="h-[124px] w-full resize-none rounded-[1.5rem] border border-[rgba(120,90,60,0.12)] bg-[#FFF9F2]/76 px-4 py-4 pr-28 text-[13px] leading-5 text-[#3C342F] outline-none transition placeholder:text-[#B09B8C] focus:border-[#F2A65A] focus:bg-[#FFFDF9] focus:ring-2 focus:ring-[#F6C65B]/20"
        />
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <motion.button
            type="button"
            title="语音输入"
            whileTap={{ scale: 0.95 }}
            onClick={handleVoice}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(120,90,60,0.10)] bg-[#F7EEDF]/90 text-[#7A6657] transition hover:bg-[#FFF4DE]"
            aria-label="语音输入"
          >
            <MicIcon />
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleSend}
            className="rounded-full bg-[#F2A65A] px-4 py-1.5 text-[11px] font-bold text-[#3C342F] shadow-[0_6px_16px_rgba(242,166,90,0.20)] transition hover:bg-[#F6C65B]"
          >
            发送
          </motion.button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] leading-4 text-[#A08C7C]">
          AI 会继续关注排队、天气、餐厅空位和路况变化。
        </p>
        <span className="shrink-0 rounded-full bg-[#EFF5E9] px-2.5 py-1 text-[10px] font-medium text-[#526849]">
          自动关注中
        </span>
      </div>
    </section>
  );
}
