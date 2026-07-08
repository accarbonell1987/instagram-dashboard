import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { SchemaSession, SchemaUpdateProfileResponse } from '@/lib/api/types';
import { setSessionState, buildSessionFromToken } from '@/modules/iam/identity/session/store';
import type { Session, SessionUser, SessionTenant } from '@/modules/iam/identity/session/store';
import { setAccessToken, fromJwt } from '@/modules/iam/identity/session/token';
import { getOrCreateDeviceId } from '@/modules/iam/authentication/lib/device';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvitationInfo {
  email: string;
  tenantName: string;
  inviterName?: string | undefined;
  role: 'TenantAdmin' | 'User';
  expiresAt: string;
  status: 'pending' | 'expired' | 'accepted';
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
}

// ─── Service functions ────────────────────────────────────────────────────────

// ─── Update Profile ───────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  fullName: string;
  phone: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<void> {
  const response = await apiFetchWithInterceptors<SchemaUpdateProfileResponse>('/users/me', {
    method: 'PATCH',
    body: { fullName: input.fullName, phone: input.phone },
  });

  const token = fromJwt(response.accessToken);
  setAccessToken(token);
  setSessionState(buildSessionFromToken());
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getInvitation(token: string): Promise<InvitationInfo> {
  return apiFetchWithInterceptors<InvitationInfo>(`/invitations/${token}`, {
    method: 'GET',
  });
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<Session> {
  const deviceId = getOrCreateDeviceId();
  const body: Record<string, unknown> = { password: input.password };
  if (deviceId) {
    body['deviceId'] = deviceId;
  }

  const response = await apiFetchWithInterceptors<SchemaSession>(
    `/invitations/${input.token}/accept`,
    {
      method: 'POST',
      body,
    }
  );

  const token = fromJwt(response.accessToken);
  setAccessToken(token);

  const user: SessionUser = {
    id: response.user.id,
    email: response.user.email,
    fullName: response.user.fullName,
    picture: response.user.picture ?? undefined,
  };

  const tenant: SessionTenant = {
    id: response.tenant.id,
    slug: response.tenant.slug,
    name: response.tenant.name ?? undefined,
  };

  const session: Session = {
    user,
    tenant,
    role: response.role,
    accessToken: response.accessToken,
    expiresAt: token.expiresAt,
  };

  setSessionState({ status: 'authenticated', session });
  return session;
}
