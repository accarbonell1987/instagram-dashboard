import { PulseDot } from "@/components/ui/PulseDot";
import type { PulseDotColor } from "@/lib/types";

const ALERTS_DATA: { label: string; sublabel: string; dotColor: PulseDotColor }[] = [
  {
    label: 'Engagement spike detected',
    sublabel: 'Post #142 · +340%',
    dotColor: 'default',
  },
  {
    label: 'Best time to post',
    sublabel: 'Today at 6:00 PM',
    dotColor: 'blue',
  },
  {
    label: 'Suggestion pending',
    sublabel: 'Use #photography on next post',
    dotColor: 'accent',
  },
];

export function DashFloat() {
  return (
    <div className="dash-float-transform bg-bg-elev/90 backdrop-blur-sm border border-border-default rounded-card shadow-card p-4 w-[220px]">
      {/* Header */}
      <div className="font-mono text-xs text-text-mute mb-3 font-semibold">
        ✦ Insights
      </div>

      {/* Alert items */}
      <div className="flex flex-col gap-3">
        {ALERTS_DATA.map((alert) => (
          <div key={alert.label} className="flex items-start gap-2.5">
            <PulseDot color={alert.dotColor} className="mt-1 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-semibold text-text-default text-xs leading-snug truncate">
                {alert.label}
              </p>
              <p className="text-text-mute text-[10px] leading-snug mt-0.5 truncate">
                {alert.sublabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
