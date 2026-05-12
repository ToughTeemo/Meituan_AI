import { useState } from "react";
import { DashboardProviders } from "@/context/DashboardProviders";
import { DashboardLayout } from "./components/DashboardLayout";
import { ConfirmPage } from "./components/warm/ConfirmPage";
import { PlanningPage } from "./components/warm/PlanningPage";
import { WarmHomePage } from "./components/warm/WarmHomePage";

type AppView = "home" | "planning" | "dashboard" | "confirm";

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [prompt, setPrompt] = useState(
    "今天下午带老婆和5岁孩子出去玩，不想太累，预算500，最好别排队，晚上8点前回家",
  );

  if (view === "home") {
    return (
      <WarmHomePage
        initialPrompt={prompt}
        onStart={(nextPrompt) => {
          setPrompt(nextPrompt);
          setView("planning");
        }}
      />
    );
  }

  if (view === "planning") {
    return (
      <PlanningPage
        prompt={prompt}
        onBack={() => setView("home")}
        onViewPlan={() => setView("dashboard")}
      />
    );
  }

  if (view === "confirm") {
    return (
      <ConfirmPage
        onBackToDashboard={() => setView("dashboard")}
        onTryAnother={() => setView("planning")}
      />
    );
  }

  return (
    <DashboardProviders>
      <DashboardLayout
        onConfirm={() => setView("confirm")}
        onHome={() => setView("home")}
      />
    </DashboardProviders>
  );
}
