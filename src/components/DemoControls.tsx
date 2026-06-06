import { motion } from "framer-motion";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import { useUI } from "@/context/UIContext";
import type { DemoRiskTrigger } from "@/mock/riskPresets";

function TriggerButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "muted";
}) {
  const cls =
    variant === "muted"
      ? "rounded-full border border-[rgba(120,90,60,0.12)] bg-white/70 px-3 py-1.5 text-[11px] font-bold text-[#6E6259] hover:bg-white"
      : "rounded-full border border-[rgba(120,90,60,0.12)] bg-[#FFF9F2]/80 px-3 py-1.5 text-[11px] font-bold text-[#6E6259] hover:bg-[#FFF4DE]";
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} className={cls} onClick={onClick}>
      {label}
    </motion.button>
  );
}

export function DemoControls() {
  const { state: ui, dispatch: uiDispatch } = useUI();
  const { triggerDemoRisk, resetDemo } = useDashboardRiskActions();

  const fire = (trigger: DemoRiskTrigger) => () => {
    triggerDemoRisk(trigger);
  };

  const toggleAutoRisk = () => {
    uiDispatch({ type: "SET_AUTO_RISK_ENABLED", enabled: !ui.autoRiskEnabled });
  };

  const appendSituation = (message: string) => {
    uiDispatch({ type: "APPEND_LOG", message });
  };

  return (
    <div
      className="rounded-[1.75rem] border border-[rgba(120,90,60,0.10)] bg-[#F7EEDF]/55 p-4 shadow-[0_8px_24px_rgba(120,80,40,0.06)]"
      aria-label="如果情况变了"
    >
      <p className="text-xs font-bold text-[#6E6259]">如果情况变了</p>
      <p className="mt-1 text-[11px] leading-snug text-[#8A7666]">
        模拟排队、下雨、孩子累了等临时变化，看看 AI 如何调整方案。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <TriggerButton
          label={ui.autoRiskEnabled ? "自动发现变化：开" : "自动发现变化：关"}
          onClick={toggleAutoRisk}
          variant="muted"
        />
        <TriggerButton label="恢复初始安排" onClick={resetDemo} variant="muted" />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <TriggerButton label="排队变长" onClick={fire("queue")} />
        <TriggerButton label="突然下雨" onClick={fire("rain")} />
        <TriggerButton label="孩子累了" onClick={fire("fatigue")} />
        <TriggerButton
          label="餐厅没位"
          onClick={() =>
            appendSituation("收到突发情况：餐厅没位。小助手会优先查找附近可预约餐厅。")
          }
        />
        <TriggerButton
          label="预算超了"
          onClick={() =>
            appendSituation("收到突发情况：预算超了。小助手会优先替换为更高性价比的选择。")
          }
        />
      </div>
    </div>
  );
}
