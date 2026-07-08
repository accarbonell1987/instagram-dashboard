'use client';

import { cn } from '@core/ui/lib';
import type { LucideIcon } from 'lucide-react';

import type { AppColor } from '@/lib/apps-config';

interface AppCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  color: AppColor;
  onClick?: () => void;
}

const colorClasses: Record<AppColor, string> = {
  blue: 'bg-app-blue',
  green: 'bg-app-green',
  purple: 'bg-app-purple',
  orange: 'bg-app-orange',
  teal: 'bg-app-teal',
  red: 'bg-app-red',
};

const iconBgClasses: Record<AppColor, string> = {
  blue: 'bg-app-blue/10 text-app-blue',
  green: 'bg-app-green/10 text-app-green',
  purple: 'bg-app-purple/10 text-app-purple',
  orange: 'bg-app-orange/10 text-app-orange',
  teal: 'bg-app-teal/10 text-app-teal',
  red: 'bg-app-red/10 text-app-red',
};

export function AppCard({ name, description, icon: Icon, color, onClick }: AppCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-card border-border focus:ring-primary group relative w-full cursor-pointer overflow-hidden rounded-sm border p-4 pl-5 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
        'hover:[box-shadow:var(--shadow-hover)]'
      )}
    >
      <div className={cn('absolute bottom-0 left-0 top-0 w-1', colorClasses[color])} />

      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm transition-transform duration-200 group-hover:scale-105',
            iconBgClasses[color]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-foreground mb-1 text-base font-medium leading-tight">{name}</h3>
          <p className="text-muted-foreground truncate text-sm">{description}</p>
        </div>
      </div>
    </button>
  );
}
