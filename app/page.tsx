import { Header } from '@/src/components/dashboard/Header';
import { Sidebar } from '@/src/components/dashboard/Sidebar';
import { SimulationMap } from '@/src/components/map/SimulationMap';
import { MetricsPanel } from '@/src/components/analytics/MetricsPanel';
import { StatusBar } from '@/src/components/dashboard/StatusBar';

export default function Page() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-gray-100">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <SimulationMap />
        <MetricsPanel />
      </div>
      <StatusBar />
    </div>
  );
}
