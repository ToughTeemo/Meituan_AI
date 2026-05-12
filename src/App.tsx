import { DashboardProviders } from "@/context/DashboardProviders";
import { DashboardLayout } from "./components/DashboardLayout";

export default function App() {
  return (
    <DashboardProviders>
      <DashboardLayout />
    </DashboardProviders>
  );
}
