import { ThreeColumnWorkspace } from "./ThreeColumnWorkspace";

interface DashboardLayoutProps {
  onConfirm: () => void;
}

export function DashboardLayout({ onConfirm }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[linear-gradient(135deg,#FFF9F2_0%,#F8F2E8_55%,#FFFDF9_100%)] text-[#3C342F]">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <ThreeColumnWorkspace onConfirm={onConfirm} />
      </div>
    </div>
  );
}
