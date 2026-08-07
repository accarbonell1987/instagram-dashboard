import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  FileText,
  Instagram,
  Layout,
  LayoutGrid,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';

export type AppColor = 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'red' | 'amber';

// Metadata visual that does NOT come from the backend (typed, tree-shakeable)
export interface ModuleVisuals {
  icon: LucideIcon;
  color: AppColor;
}

export const moduleVisuals: Record<string, ModuleVisuals> = {
  'ig-basic-metrics': {
    icon: BarChart3,
    color: 'blue',
  },
  'ig-publications': {
    icon: FileText,
    color: 'green',
  },
  'ig-ai-agent': {
    icon: Bot,
    color: 'purple',
  },
  'ig-ai-chat': {
    icon: MessageSquare,
    color: 'purple',
  },
  'ig-ai-suggestions': {
    icon: Lightbulb,
    color: 'amber',
  },
  'ig-ai-carousels': {
    icon: Layout,
    color: 'orange',
  },
};

export const productVisuals: Record<string, ModuleVisuals> = {
  'instagram-dashboard': {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- brand icon still needed
    icon: Instagram,
    color: 'orange',
  },
};

const FALLBACK_VISUALS: ModuleVisuals = { icon: LayoutGrid, color: 'blue' };

// A product without a hand-picked icon still renders — it used to be dropped
// from the grid, which silently hid anything newly created in backoffice.
export function getProductVisuals(productId: string): ModuleVisuals {
  return productVisuals[productId] ?? FALLBACK_VISUALS;
}

// A relative defaultUrl marks content the hub itself serves as an internal
// page, rather than a remote app to iframe. No product uses this today (every
// defaultUrl is absolute) but a future hub-hosted product can opt in for free.
export function isLocalUrl(defaultUrl: string): boolean {
  return defaultUrl.startsWith('/');
}
