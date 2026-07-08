'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@core/ui';
import type { JSX } from 'react';

import { InvitationsList } from './invitations-list';
import { InviteForm } from './invite-form';
import { MembersList } from './members-list';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MemberListItem = components['schemas']['MemberListItem'];
type InvitationListItem = components['schemas']['InvitationListItem'];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TeamTabsProps {
  activeTab: 'members' | 'invitations';
  onTabChange: (tab: 'members' | 'invitations') => void;
  // Members
  members: MemberListItem[];
  isLoadingMembers: boolean;
  currentUserId: string;
  onSuspend: (memberId: string) => void;
  onActivate: (memberId: string) => void;
  onDelete: (memberId: string, email: string) => void;
  // Invitations
  invitations: InvitationListItem[];
  isLoadingInvitations: boolean;
  onRevoke: (id: string, email: string) => void;
  onInviteSuccess: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function TeamTabs({
  activeTab,
  onTabChange,
  members,
  isLoadingMembers,
  currentUserId,
  onSuspend,
  onActivate,
  onDelete,
  invitations,
  isLoadingInvitations,
  onRevoke,
  onInviteSuccess,
}: TeamTabsProps): JSX.Element {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        onTabChange(value as 'members' | 'invitations');
      }}
    >
      <TabsList>
        <TabsTrigger value="members">Miembros</TabsTrigger>
        <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4">
        <MembersList
          members={members}
          isLoading={isLoadingMembers}
          currentUserId={currentUserId}
          onSuspend={onSuspend}
          onActivate={onActivate}
          onDelete={onDelete}
        />
      </TabsContent>

      <TabsContent value="invitations" className="mt-4">
        <div className="flex flex-col gap-6">
          <InviteForm onSuccess={onInviteSuccess} />
          <InvitationsList
            invitations={invitations}
            isLoading={isLoadingInvitations}
            onRevoke={onRevoke}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
