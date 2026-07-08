'use client';

import { createContext, useContext, type ReactNode, type JSX } from 'react';

import type { DraftState } from '../services/draft.service';
import type { Plan } from '../services/plans.service';

// ─── Context types ────────────────────────────────────────────────────────────

export interface DraftContextValue {
  draft: DraftState;
  plan: Plan | null;
  draftId: string;
  refresh: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DraftProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: DraftContextValue;
}): JSX.Element {
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDraftContext(): DraftContextValue {
  const context = useContext(DraftContext);
  if (context === null) {
    throw new Error('useDraftContext must be used within a DraftProvider');
  }
  return context;
}
