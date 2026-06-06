import { useState } from "react";
import { createPlan, listPlans, type PlanResponse } from "@/api/plans";
import { DashboardProviders } from "@/context/DashboardProviders";
import { getOrCreateSessionId } from "@/utils/session";
import { DashboardLayout } from "./components/DashboardLayout";
import { ConfirmPage } from "./components/warm/ConfirmPage";
import { PlanningPage } from "./components/warm/PlanningPage";
import { WarmHomePage } from "./components/warm/WarmHomePage";

type AppView = "home" | "planning" | "dashboard" | "confirm";

export default function App() {
  const [sessionId] = useState(getOrCreateSessionId);
  const [view, setView] = useState<AppView>("home");
  const [prompt, setPrompt] = useState(
    "今天下午带老婆和5岁孩子出去玩，不想太累，预算500，最好别排队，晚上8点前回家",
  );
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [recentPlans, setRecentPlans] = useState<PlanResponse[]>([]);
  const [planReady, setPlanReady] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(false);

  const rememberPlan = (nextPlan: PlanResponse) => {
    setRecentPlans((currentPlans) =>
      [
        nextPlan,
        ...currentPlans.filter((item) => item.plan_id !== nextPlan.plan_id),
      ].slice(0, 6),
    );
  };

  const loadCurrentSessionPlans = () => {
    void (async () => {
      try {
        const plans = await listPlans(sessionId);
        setRecentPlans(plans.length ? plans : plan ? [plan] : []);
      } catch (error) {
        console.warn("Failed to load current session plans.", error);
      }
    })();
  };

  const recentPlanLabels = recentPlans.map(
    (item) => item.summary?.title || item.constraints.goal || item.plan_id,
  );

  const startPlanning = (nextPrompt: string) => {
    setPrompt(nextPrompt);
    setPlanReady(false);
    setFallbackNotice(false);
    setView("planning");

    void (async () => {
      try {
        const nextPlan = await createPlan({
          prompt: nextPrompt,
          sessionId,
        });
        setPlan(nextPlan);
        rememberPlan(nextPlan);
        setFallbackNotice(nextPlan.source === "mock");
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
        planId={plan?.plan_id ?? null}
        onBackToDashboard={() => setView("dashboard")}
        onTryAnother={() => setView("planning")}
      />
    );
  }

  return (
    <DashboardProviders
      initialPlan={plan}
    >
      <DashboardLayout
        onConfirm={() => setView("confirm")}
        onHome={() => setView("home")}
        onPlansClick={loadCurrentSessionPlans}
        recentPlanLabels={recentPlanLabels}
      />
    </DashboardProviders>
  );
}
