'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@core/ui';
import { type JSX } from 'react';

import { MemberActionsMenu } from './member-actions-menu';
import { MemberStatusBadge } from './member-status-badge';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MemberListItem = components['schemas']['MemberListItem'];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MembersListProps {
  members: MemberListItem[];
  isLoading?: boolean;
  currentUserId: string;
  onSuspend: (memberId: string) => void;
  onActivate: (memberId: string) => void;
  onDelete: (memberId: string, email: string) => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function MemberSkeleton(): JSX.Element {
  return (
    <div className="flex items-center gap-4 py-3" aria-hidden="true">
      <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      <div className="bg-muted h-4 w-20 animate-pulse rounded" />
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MembersList({
  members,
  isLoading = false,
  currentUserId,
  onSuspend,
  onActivate,
  onDelete,
}: MembersListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="divide-border divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <MemberSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">No hay miembros</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre / Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const status = member.status;
            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="font-medium">
                    {member.fullName != null && member.fullName.length > 0
                      ? member.fullName
                      : member.email}
                  </div>
                  {member.fullName != null && member.fullName.length > 0 && (
                    <div className="text-muted-foreground text-xs">{member.email}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{member.role}</TableCell>
                <TableCell>
                  <MemberStatusBadge status={status} />
                </TableCell>
                <TableCell>
                  <MemberActionsMenu
                    memberId={member.id}
                    memberEmail={member.email}
                    currentStatus={status}
                    isSelf={member.id === currentUserId}
                    onSuspend={onSuspend}
                    onActivate={onActivate}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
