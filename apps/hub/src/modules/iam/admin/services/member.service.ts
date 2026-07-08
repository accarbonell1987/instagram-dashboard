import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

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
