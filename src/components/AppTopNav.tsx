import { useState } from "react";

type NavItem = "scenes" | "plans" | "demo";

interface AppTopNavProps {
  showBack?: boolean;
  onBack?: () => void;
  onHomeClick?: () => void;
  activeItem?: NavItem;
  statusLabel?: string;
  onScenesClick?: () => void;
  onPlansClick?: () => void;
  onDemoClick?: () => void;
}

const SCENES = [
  "亲子半日游",
  "宠物友好路线",
  "轻松约会",
  "雨天也能玩",
  "少排队慢节奏",
  "500 元以内",
] as const;

const RECENT_PLANS = [
  "今天下午亲子半日游",
  "周末宠物友好路线",
  "雨天室内轻松玩",
  "朋友小聚少排队路线",
] as const;

const DEMO_ITEMS = [
  "自动播放规划过程",
  "模拟排队变长",
  "模拟突然下雨",
  "模拟孩子累了",
  "恢复初始状态",
] as const;

function Popover({
  type,
  onClose,
}: {
  type: NavItem;
  onClose: () => void;
}) {
  const title =
    type === "scenes"
      ? "可以这样开口"
      : type === "plans"
        ? "最近方案"
        : "演示入口";
  const items =
    type === "scenes" ? SCENES : type === "plans" ? RECENT_PLANS : DEMO_ITEMS;

  return (
    <div className="absolute right-0 top-[calc(100%+12px)] w-[280px] rounded-[1.35rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9]/96 p-3 text-left shadow-[0_16px_40px_rgba(80,50,20,0.10)] backdrop-blur">
      <p className="px-2 pb-2 text-xs font-semibold text-[#9A8575]">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium text-[#5F5148] transition hover:bg-[#F8F2E8]"
          >
            <span>{item}</span>
            <span className="text-[#C49A65]">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppTopNav({
  showBack = false,
  onBack,
  onHomeClick,
  activeItem,
  statusLabel,
  onScenesClick,
  onPlansClick,
  onDemoClick,
}: AppTopNavProps) {
  const [openPanel, setOpenPanel] = useState<NavItem | null>(null);

  const togglePanel = (item: NavItem) => {
    setOpenPanel((current) => (current === item ? null : item));
  };

  const handleItemClick = (item: NavItem) => {
    if (item === "scenes" && onScenesClick) {
      onScenesClick();
      setOpenPanel(null);
      return;
    }

    if (item === "plans") onPlansClick?.();
    if (item === "demo") onDemoClick?.();
    togglePanel(item);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(120,90,60,0.08)] bg-[#FFF9F2]/72 shadow-[0_8px_24px_rgba(80,50,20,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="hidden rounded-full border border-[rgba(120,90,60,0.12)] bg-white/58 px-3.5 py-2 text-sm font-semibold text-[#6E6259] transition hover:bg-white md:inline-flex"
            >
              ← 返回首页
            </button>
          ) : null}

          <button
            type="button"
            onClick={onHomeClick}
            className="flex min-w-0 items-center gap-3 rounded-[1.35rem] px-1 py-1 text-left transition hover:bg-white/38"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F6C65B] text-lg shadow-[0_12px_30px_rgba(120,80,40,0.14)]">
              ☀️
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight text-[#3C342F]">
                周末小助手
              </span>
              <span className="hidden truncate text-[11px] text-[#8A7666] sm:block">
                Meituan Weekend AI
              </span>
            </span>
          </button>

          {statusLabel ? (
            <span className="hidden rounded-full bg-[#EFF5E9] px-3 py-1 text-xs font-semibold text-[#526849] lg:inline-flex">
              {statusLabel}
            </span>
          ) : null}
        </div>

        <nav className="relative flex shrink-0 items-center gap-1 text-sm text-[#6E6259] sm:gap-2">
          <button
            className={`hidden rounded-full px-3 py-2 font-medium transition hover:bg-white/58 hover:text-[#8A5A2F] md:inline-flex ${
              activeItem === "scenes" ? "bg-white/58 text-[#8A5A2F]" : ""
            }`}
            type="button"
            onClick={() => handleItemClick("scenes")}
          >
            示例场景
          </button>
          <button
            className={`hidden rounded-full px-3 py-2 font-medium transition hover:bg-white/58 hover:text-[#8A5A2F] md:inline-flex ${
              activeItem === "plans" ? "bg-white/58 text-[#8A5A2F]" : ""
            }`}
            type="button"
            onClick={() => handleItemClick("plans")}
          >
            我的方案
          </button>
          <button
            className={`rounded-full border border-[rgba(160,120,80,0.18)] bg-[#FFF9F2]/65 px-4 py-2 font-semibold text-[#7A6657] transition hover:bg-[#FFF4DE] sm:px-5 ${
              activeItem === "demo" ? "bg-[#FFF4DE] text-[#8A5A2F]" : ""
            }`}
            type="button"
            onClick={() => handleItemClick("demo")}
          >
            演示模式
          </button>

          {openPanel ? (
            <Popover type={openPanel} onClose={() => setOpenPanel(null)} />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
