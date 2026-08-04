import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

export interface AdminProductRole {
  id: string;
  productId: string;
  key: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ListRolesResponse {
  roles: AdminProductRole[];
}

export async function listProductRoles(productId: string): Promise<AdminProductRole[]> {
  const response = await apiFetchWithInterceptors<ListRolesResponse>(
    `/admin/products/${productId}/roles`,
    { method: 'GET' },
  );
  return response.roles;
}

export async function createProductRole(
  productId: string,
  data: { key: string; name: string },
): Promise<AdminProductRole> {
  return apiFetchWithInterceptors<AdminProductRole>(`/admin/products/${productId}/roles`, {
    method: 'POST',
    body: data,
  });
}

export async function updateProductRole(
  productId: string,
  roleId: string,
  data: { name: string },
): Promise<AdminProductRole> {
  return apiFetchWithInterceptors<AdminProductRole>(
    `/admin/products/${productId}/roles/${roleId}`,
    { method: 'PATCH', body: data },
  );
}

export async function deleteProductRole(productId: string, roleId: string): Promise<void> {
  await apiFetchWithInterceptors(`/admin/products/${productId}/roles/${roleId}`, {
    method: 'DELETE',
  });
}

export async function getRoleModules(roleId: string): Promise<string[]> {
  const response = await apiFetchWithInterceptors<{ moduleIds: string[] }>(
    `/admin/roles/${roleId}/modules`,
    { method: 'GET' },
  );
  return response.moduleIds;
}

export async function setRoleModules(roleId: string, moduleIds: string[]): Promise<void> {
  await apiFetchWithInterceptors(`/admin/roles/${roleId}/modules`, {
    method: 'PUT',
    body: { moduleIds },
  });
}
