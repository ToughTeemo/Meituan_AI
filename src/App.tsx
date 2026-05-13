import { useState } from "react";
import { DashboardProviders } from "@/context/DashboardProviders";
import {
  generatePlan,
  parseGoal,
  resetApiFallbackFlag,
  wasApiFallbackUsed,
} from "@/services/api";
import type { Constraints, PlanBundle } from "@/types/plan";
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
  const [planBundle, setPlanBundle] = useState<PlanBundle | undefined>();
  const [planConstraints, setPlanConstraints] = useState<Constraints | undefined>();
  const [planReady, setPlanReady] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(false);

  const startPlanning = (nextPrompt: string) => {
    setPrompt(nextPrompt);
    setPlanReady(false);
    setFallbackNotice(false);
    setView("planning");

    void (async () => {
      resetApiFallbackFlag();
      try {
        const parsed = await parseGoal(nextPrompt);
        const nextPlan = await generatePlan(parsed);
        setPlanConstraints(parsed);
        setPlanBundle(nextPlan);
        setFallbackNotice(wasApiFallbackUsed());
      } catch (error) {
        console.warn("Plan generation failed before fallback could complete.", error);
        setFallbackNotice(true);
      } finally {
        setPlanReady(true);
      }
    })();
  };

  if (view === "home") {
    return (
      <WarmHomePage
        initialPrompt={prompt}
        onStart={startPlanning}
      />
    );
  }

  if (view === "planning") {
    return (
      <PlanningPage
        prompt={prompt}
        onBack={() => setView("home")}
        onViewPlan={() => setView("dashboard")}
        planReady={planReady}
        fallbackNotice={fallbackNotice}
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
    <DashboardProviders
      initialBundle={planBundle}
      initialConstraints={planConstraints}
    >
      <DashboardLayout
        onConfirm={() => setView("confirm")}
        onHome={() => setView("home")}
      />
    </DashboardProviders>
  );
}
