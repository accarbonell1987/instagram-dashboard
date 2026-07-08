import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Database,
  FileText,
  Palmtree,
  Search,
  Settings,
  Users,
  GraduationCap,
  Instagram,
} from 'lucide-react';

export type AppColor = 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'red';

// Metadata visual that does NOT come from the backend (typed, tree-shakeable)
export interface ModuleVisuals {
  icon: LucideIcon;
  color: AppColor;
}

export const moduleVisuals: Record<string, ModuleVisuals> = {
  'buscador-app': {
    icon: Search,
    color: 'blue',
  },
  'facturacion-app': {
    icon: FileText,
    color: 'green',
  },
  'rrhh-app': {
    icon: Users,
    color: 'purple',
  },
  'reportes-app': {
    icon: BarChart3,
    color: 'orange',
  },
  'inventario-app': {
    icon: Database,
    color: 'teal',
  },
  'configuracion-app': {
    icon: Settings,
    color: 'red',
  },
  'vacaciones-app': {
    icon: Palmtree,
    color: 'teal',
  },
  prueba: {
    icon: GraduationCap,
    color: 'purple',
  },
  'dashboard-instagram': {
    icon: Instagram,
    color: 'orange',
  },
};

export function isLocalModule(defaultUrl: string): boolean {
  return defaultUrl.startsWith('/');
}
