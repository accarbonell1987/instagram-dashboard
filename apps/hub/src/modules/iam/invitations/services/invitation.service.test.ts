import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import { getInvitation, acceptInvitation } from './invitation.service';

import { ApiError } from '@/lib/api/errors';
import { server } from '@/lib/mocks/server';
import { getSessionState } from '@/modules/iam/identity/session/store';

const BASE = 'http://localhost:8080';

describe('invitation.service', () => {
  describe('getInvitation', () => {
    it('returns invitation info for a valid token', async () => {
      const result = await getInvitation('valid-token-123');
      expect(result.email).toBe('nuevo@empresa.com');
      expect(result.tenantName).toBe('Empresa Acme S.A.');
      expect(result.inviterName).toBe('Ana Pereira');
      expect(result.role).toBe('User');
      expect(result.status).toBe('pending');
    });

    it('throws ApiError with status 410 for expired invitation', async () => {
      server.use(
        http.get(`${BASE}/invitations/:token`, () =>
          HttpResponse.json({ title: 'Gone', status: 410, detail: 'Invitation expired' }, { status: 410 })
        )
      );

      await expect(getInvitation('expired-token')).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('acceptInvitation', () => {
    it('returns a session and updates the session store on success', async () => {
      const session = await acceptInvitation({ token: 'valid-token-123', password: 'SecureP@ss1!' });
      expect(session.user.email).toBeTruthy();
      expect(session.role).toBe('User');
      // Store should be updated
      const state = getSessionState();
      expect(state.status).toBe('authenticated');
    });
  });
});
