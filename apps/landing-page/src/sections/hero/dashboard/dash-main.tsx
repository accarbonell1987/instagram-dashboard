import { KpiCard } from '@/components/ui/KpiCard';
import { DashChart } from './dash-chart';
import type { KpiData } from '@/lib/types';

const DASHBOARD_DATA: KpiData[] = [
  { label: 'Followers', value: '24.8K', delta: '+12%', deltaUp: true, highlight: false },
  { label: 'Engagement', value: '5.2%', delta: '+0.8%', deltaUp: true, highlight: true },
  { label: 'Reach', value: '18.3K', delta: '-3%', deltaUp: false, highlight: false },
];

export function DashMain() {
  return (
    <div className="dash-main-transform bg-bg-elev/90 border-border-default rounded-card shadow-dashboard w-full max-w-[460px] overflow-hidden border backdrop-blur-sm">
      {/* macOS-style chrome header */}
      <div className="border-border-default bg-surface flex items-center gap-3 border-b px-4 py-3">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-text-mute flex-1 text-center font-mono text-xs">
          InstaMetrics · live · 14:32:07
        </span>
        <span className="text-success font-mono text-xs">● optimizando</span>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* KPI row */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          {DASHBOARD_DATA.map((kpi) => (
            <KpiCard key={kpi.label} data={kpi} />
          ))}
        </div>

        {/* Chart */}
        <DashChart />
      </div>
    </div>
  );
}
