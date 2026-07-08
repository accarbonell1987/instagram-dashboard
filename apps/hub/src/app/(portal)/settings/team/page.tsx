'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, type JSX } from 'react';

import type { components } from '@/lib/api/types';
import { DeleteMemberDialog } from '@/modules/iam/admin/components/delete-member-dialog';
import { RevokeConfirmDialog } from '@/modules/iam/admin/components/revoke-confirm-dialog';
import { SuspendConfirmDialog } from '@/modules/iam/admin/components/suspend-confirm-dialog';
import { TeamTabs } from '@/modules/iam/admin/components/team-tabs';
import {
  listAdminInvitations,
  revokeAdminInvitation,
} from '@/modules/iam/admin/services/invitation.service';
import { updateMemberStatus, deleteMember } from '@/modules/iam/admin/services/member.service';
import { getTenantMembers } from '@/modules/iam/admin/services/organization.service';
import { RequireRole } from '@/modules/iam/identity/guards/require-role';
import { useSession } from '@/modules/iam/identity/hooks/use-session';

// ─── Types ─────────────────────────────────────────────────────────────────────

type InvitationListItem = components['schemas']['InvitationListItem'];
type MemberListItem = components['schemas']['MemberListItem'];

// ─── Inner component (needs useSearchParams) ───────────────────────────────────

function TeamPageInner(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab: 'members' | 'invitations' = rawTab === 'invitations' ? 'invitations' : 'members';

  const sessionState = useSession();
  const currentUserId =
    sessionState.status === 'authenticated' && sessionState.session !== null
      ? sessionState.session.user.id
      : '';

  const [invitations, setInvitations] = useState<InvitationListItem[]>([]);
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Revoke dialog state
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeEmail, setRevokeEmail] = useState<string | null>(null);

  // Suspend dialog state
  const [suspendMemberId, setSuspendMemberId] = useState<string | null>(null);
  const [suspendMemberEmail, setSuspendMemberEmail] = useState<string | null>(null);

  // Delete dialog state
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deleteMemberEmail, setDeleteMemberEmail] = useState<string | null>(null);

  async function loadInvitations(): Promise<void> {
    setIsLoadingInvitations(true);
    try {
      const response = await listAdminInvitations();
      setInvitations(response.items);
    } catch {
      // Silently fail — UI shows empty state
    } finally {
      setIsLoadingInvitations(false);
    }
  }

  async function loadMembers(): Promise<void> {
    setIsLoadingMembers(true);
    try {
      const response = await getTenantMembers();
      setMembers(response.items);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingMembers(false);
    }
  }

  useEffect(() => {
    void loadInvitations();
    void loadMembers();
  }, []);

  // ─── Tab handler ────────────────────────────────────────────────────────────

  function handleTabChange(tab: 'members' | 'invitations'): void {
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  // ─── Revoke handlers ────────────────────────────────────────────────────────

  function handleRevokeClick(id: string, email: string): void {
    setRevokeId(id);
    setRevokeEmail(email);
  }

  function handleRevokeCancel(): void {
    setRevokeId(null);
    setRevokeEmail(null);
  }

  async function handleRevokeConfirm(): Promise<void> {
    if (revokeId === null) return;
    await revokeAdminInvitation(revokeId);
    setRevokeId(null);
    setRevokeEmail(null);
    await loadInvitations();
  }

  // ─── Suspend handler ────────────────────────────────────────────────────────

  function handleSuspendClick(memberId: string): void {
    const member = members.find((m) => m.id === memberId);
    setSuspendMemberId(memberId);
    setSuspendMemberEmail(member?.email ?? null);
  }

  function handleSuspendCancel(): void {
    setSuspendMemberId(null);
    setSuspendMemberEmail(null);
  }

  async function handleSuspendConfirm(): Promise<void> {
    if (suspendMemberId === null) return;
    await updateMemberStatus(suspendMemberId, 'suspended');
    setSuspendMemberId(null);
    setSuspendMemberEmail(null);
    await loadMembers();
  }

  // ─── Activate handler (no confirm dialog needed) ────────────────────────────

  async function handleActivateClick(memberId: string): Promise<void> {
    await updateMemberStatus(memberId, 'active');
    await loadMembers();
  }

  // ─── Delete handlers ────────────────────────────────────────────────────────

  function handleDeleteClick(memberId: string, email: string): void {
    setDeleteMemberId(memberId);
    setDeleteMemberEmail(email);
  }

  function handleDeleteCancel(): void {
    setDeleteMemberId(null);
    setDeleteMemberEmail(null);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (deleteMemberId === null) return;
    await deleteMember(deleteMemberId);
    setDeleteMemberId(null);
    setDeleteMemberEmail(null);
    await loadMembers();
  }

  return (
    <RequireRole role={['TenantAdmin', 'SuperAdmin']}>
      <div className="flex flex-col gap-6">
        <h2 className="text-foreground text-xl font-semibold">Equipo</h2>

        <TeamTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          members={members}
          isLoadingMembers={isLoadingMembers}
          currentUserId={currentUserId}
          onSuspend={handleSuspendClick}
          onActivate={(memberId) => void handleActivateClick(memberId)}
          onDelete={handleDeleteClick}
          invitations={invitations}
          isLoadingInvitations={isLoadingInvitations}
          onRevoke={handleRevokeClick}
          onInviteSuccess={() => void loadInvitations()}
        />
      </div>

      {/* Revoke dialog */}
      <RevokeConfirmDialog
        email={revokeEmail}
        invitationId={revokeId}
        onConfirm={handleRevokeConfirm}
        onCancel={handleRevokeCancel}
      />

      {/* Suspend dialog */}
      <SuspendConfirmDialog
        email={suspendMemberEmail}
        memberId={suspendMemberId}
        action="suspend"
        onConfirm={handleSuspendConfirm}
        onCancel={handleSuspendCancel}
      />

      {/* Delete member dialog */}
      <DeleteMemberDialog
        memberId={deleteMemberId}
        memberEmail={deleteMemberEmail}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </RequireRole>
  );
}

// ─── Page (wraps inner in Suspense for useSearchParams) ────────────────────────

export default function TeamPage(): JSX.Element {
  return (
    <Suspense>
      <TeamPageInner />
    </Suspense>
  );
}
