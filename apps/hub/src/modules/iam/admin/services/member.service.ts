import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

export type TenantProductRoles =
  components['schemas']['TenantProductRolesResponse']['products'][number];

/** The roles this tenant may hand out, grouped by the product that defines them. */
export async function listTenantProductRoles(): Promise<TenantProductRoles[]> {
  const response = await apiFetchWithInterceptors<
    components['schemas']['TenantProductRolesResponse']
  >('/tenants/current/product-roles', { method: 'GET' });
  return response.products;
}

/**
 * Replaces a member's product access wholesale. An empty array revokes it all —
 * the endpoint takes the complete set, not a delta.
 */
export async function setMemberProductRoles(
  memberId: string,
  productRoleIds: string[],
): Promise<void> {
  await apiFetchWithInterceptors(`/tenants/current/members/${memberId}/product-roles`, {
    method: 'PUT',
    body: { productRoleIds },
  });
}

export async function updateMemberStatus(
  memberId: string,
  status: 'active' | 'suspended',
): Promise<void> {
  await apiFetchWithInterceptors(`/tenants/current/members/${memberId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function deleteMember(memberId: string): Promise<void> {
  await apiFetchWithInterceptors(`/tenants/current/members/${memberId}`, {
    method: 'DELETE',
  });
}
