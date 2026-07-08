import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

type CreateInvitationRequest = components['schemas']['CreateInvitationRequest'];
type CreateInvitationResponse = components['schemas']['CreateInvitationResponse'];
type InvitationListResponse = components['schemas']['InvitationListResponse'];

export async function createAdminInvitation(
  data: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  return apiFetchWithInterceptors<CreateInvitationResponse>('/invitations', {
    method: 'POST',
    body: data,
  });
}

export async function listAdminInvitations(
  status?: string,
): Promise<InvitationListResponse> {
  const qs = status !== undefined ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetchWithInterceptors<InvitationListResponse>(`/invitations${qs}`);
}

export async function revokeAdminInvitation(id: string): Promise<void> {
  await apiFetchWithInterceptors<void>(`/invitations/${id}`, { method: 'DELETE' });
}
