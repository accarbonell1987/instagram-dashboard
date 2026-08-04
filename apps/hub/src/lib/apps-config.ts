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

// A module or product without a hand-picked icon still renders — it used to be
// dropped from the grid, which silently hid anything newly created in backoffice.
export function getModuleVisuals(moduleId: string): ModuleVisuals {
  return moduleVisuals[moduleId] ?? FALLBACK_VISUALS;
}

export function getProductVisuals(productId: string): ModuleVisuals {
  return productVisuals[productId] ?? FALLBACK_VISUALS;
}

export function isLocalModule(defaultUrl: string): boolean {
  return defaultUrl.startsWith('/');
}
