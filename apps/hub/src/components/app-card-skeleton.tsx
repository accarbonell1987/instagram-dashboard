import { Skeleton } from '@core/ui';

export function AppCardSkeleton() {
  return (
    <div className="bg-card border-border relative w-full overflow-hidden rounded-sm border p-4 pl-5 transition-all duration-200">
      <div className="absolute bottom-0 left-0 top-0 w-1">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 flex-shrink-0 rounded-sm" />

        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
