import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

export interface AccessibleModule {
  id: string;
  name: string;
  description: string | undefined;
  defaultUrl: string;
  source: 'plan' | 'override' | 'admin';
  parentId: string | null;
}

export async function getAccessibleModules(): Promise<AccessibleModule[]> {
  const response = await apiFetchWithInterceptors<{ modules: AccessibleModule[] }>(
    '/tenants/current/modules'
  );
  return response.modules;
}
