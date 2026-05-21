import { AppTopNav } from "@/components/AppTopNav";
import { ThreeColumnWorkspace } from "./ThreeColumnWorkspace";

interface DashboardLayoutProps {
  onConfirm: () => void;
  onHome?: () => void;
  onPlansClick?: () => void;
  recentPlanLabels?: string[];
}

export function DashboardLayout({
  onConfirm,
  onHome,
  onPlansClick,
  recentPlanLabels,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_55%,#FFFDF9_100%)] text-[#3C342F]">
      <AppTopNav
        statusLabel="Shanghai MVP Route"
        onHomeClick={onHome}
        onPlansClick={onPlansClick}
        recentPlanLabels={recentPlanLabels}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ThreeColumnWorkspace onConfirm={onConfirm} />
      </div>
    </div>
  );
}
