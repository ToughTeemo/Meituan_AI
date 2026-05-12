import { ThreeColumnWorkspace } from "./ThreeColumnWorkspace";

export function DashboardLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <ThreeColumnWorkspace />
      </div>
    </div>
  );
}
