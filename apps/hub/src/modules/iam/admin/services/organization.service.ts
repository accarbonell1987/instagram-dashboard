import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

type Tenant = components['schemas']['Tenant'];
type MemberListResponse = components['schemas']['MemberListResponse'];

export async function getCurrentTenant(): Promise<Tenant> {
  return apiFetchWithInterceptors<Tenant>('/tenants/current');
}

export async function getTenantMembers(): Promise<MemberListResponse> {
  return apiFetchWithInterceptors<MemberListResponse>('/tenants/current/members');
}

export async function updateTenantName(name: string): Promise<void> {
  await apiFetchWithInterceptors('/tenants/current', {
    method: 'PATCH',
    body: { name },
  });
}

/** Visual style for the whole tenant — every user of it sees this on open. */
export async function updateTenantColorTheme(colorTheme: string): Promise<void> {
  await apiFetchWithInterceptors('/tenants/current', {
    method: 'PATCH',
    body: { colorTheme },
  });
}
