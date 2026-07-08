'use client';

import { useEffect, useState, type JSX } from 'react';

import { SettingsStatsCard } from '@/modules/iam/admin/components/settings-stats-card';
import { getCurrentTenant, getTenantMembers } from '@/modules/iam/admin/services/organization.service';
import { listAdminInvitations } from '@/modules/iam/admin/services/invitation.service';
import { RequireRole } from '@/modules/iam/identity/guards/require-role';
import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MemberListItem = components['schemas']['MemberListItem'];
type InvitationListItem = components['schemas']['InvitationListItem'];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationListItem[]>([]);

  useEffect(() => {
    void Promise.allSettled([
      getCurrentTenant(),
      getTenantMembers(),
      listAdminInvitations(),
    ]).then(([, membersResult, invitationsResult]) => {
      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value.items);
      }
      if (invitationsResult.status === 'fulfilled') {
        setInvitations(invitationsResult.value.items);
      }
      setIsLoading(false);
    });
  }, []);

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === 'active').length;
  const suspendedMembers = members.filter((m) => m.status === 'suspended').length;
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending').length;

  return (
    <RequireRole role={['TenantAdmin', 'SuperAdmin']}>
      <div className="flex flex-col gap-6">
        <h2 className="text-foreground text-xl font-semibold">Resumen</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SettingsStatsCard label="Miembros" value={totalMembers} isLoading={isLoading} />
          <SettingsStatsCard label="Activos" value={activeMembers} isLoading={isLoading} />
          <SettingsStatsCard label="Suspendidos" value={suspendedMembers} isLoading={isLoading} />
          <SettingsStatsCard
            label="Invitaciones pendientes"
            value={pendingInvitations}
            isLoading={isLoading}
          />
        </div>
      </div>
    </RequireRole>
  );
}
