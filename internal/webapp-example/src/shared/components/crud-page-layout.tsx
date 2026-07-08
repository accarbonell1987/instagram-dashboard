'use client';

import { Badge, Button } from '@core/ui';
import { PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface CrudPageLayoutProps {
  /** Icon component to display in the header */
  icon: ReactNode;
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Total count of items for the badge */
  total: number;
  /** Label for the count badge (e.g., "users", "parties") */
  countLabel: string;
  /** Label for the create button */
  createLabel: string;
  /** Callback when create button is clicked */
  onCreateClick: () => void;
  /** Search input component */
  searchInput: ReactNode;
  /** Main content (table) */
  children: ReactNode;
  /** Pagination component */
  pagination?: ReactNode;
  /** Error message to display */
  error?: string | null;
  /** Callback to clear error */
  onClearError?: () => void;
  /** Additional action buttons in the header */
  headerActions?: ReactNode;
}

export function CrudPageLayout({
  icon,
  title,
  description,
  total,
  countLabel,
  createLabel,
  onCreateClick,
  searchInput,
  children,
  pagination,
  error,
  onClearError,
  headerActions,
}: CrudPageLayoutProps) {
  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 text-destructive mb-4 flex items-center justify-between rounded-lg px-4 py-3">
            <span>{error}</span>
            {onClearError && (
              <Button variant="ghost" size="sm" onClick={onClearError}>
                Dismiss
              </Button>
            )}
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary h-8 w-8">{icon}</div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <Button onClick={onCreateClick}>
              <PlusIcon className="mr-2 h-4 w-4" />
              {createLabel}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-2">
          {searchInput}
          <Badge variant="secondary">
            {total} {countLabel}
          </Badge>
        </div>

        {/* Table */}
        <div className="rounded-lg border">{children}</div>

        {/* Pagination */}
        {pagination}
      </div>
    </main>
  );
}
