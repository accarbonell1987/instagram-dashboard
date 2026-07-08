import { DashMain } from './dash-main';
import { DashFloat } from './dash-float';
import { Particles } from './particles';

export function HeroDashboard() {
  return (
    <div className="dash-perspective shadow-dashboard relative" aria-hidden="true">
      {/* Radial glow behind dashboard */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[2rem]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(26,110,196,0.2), transparent 70%)',
        }}
      />

      {/* Particles (decorative floating dots) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
        <Particles />
      </div>

      {/* Dashboard panels */}
      <div className="relative flex min-h-[360px] flex-col items-center px-4 pb-12 pt-8">
        <DashMain />

        {/* Float panel — overlaps main, positioned bottom-right */}
        <div className="absolute bottom-0 right-4 lg:right-0">
          <DashFloat />
        </div>
      </div>
    </div>
  );
}
