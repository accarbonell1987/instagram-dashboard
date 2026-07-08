import { cn } from '@core/ui/lib';
import * as React from 'react';

interface ExampleProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
}

export function Example({ title, className, children, ...props }: ExampleProps) {
  return (
    <div className="w-full">
      {title && <h2 className="text-foreground/80 mb-4 text-lg font-semibold">{title}</h2>}
      <div
        className={cn(
          'bg-card flex min-h-50 w-full items-start justify-start rounded-lg border p-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

interface ExampleWrapperProps {
  children: React.ReactNode;
}

export function ExampleWrapper({ children }: ExampleWrapperProps) {
  return <div className="container mx-auto space-y-8 px-4 py-12">{children}</div>;
}
