'use client';

import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '@core/ui';
import { KeyRound } from 'lucide-react';
import { type JSX } from 'react';

import { MemberActionsMenu } from './member-actions-menu';
import { MemberStatusBadge } from './member-status-badge';

import { DataTable, Td, Th, Tr } from '@/components/data-table';
import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MemberListItem = components['schemas']['MemberListItem'];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MembersListProps {
  members: MemberListItem[];
  isLoading?: boolean | undefined;
  currentUserId: string;
  onSuspend: (memberId: string) => void;
  onActivate: (memberId: string) => void;
  onDelete: (memberId: string, email: string) => void;
  onEditAccess: (memberId: string) => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

/**
 * A row, not a loose div: the skeleton sits inside the same table as the data,
 * so the header stays put and the layout does not jump when the members land.
 */
function MemberSkeletonRow(): JSX.Element {
  return (
    <Tr aria-hidden>
      <Td>
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      </Td>
      <Td>
        <div className="bg-muted h-4 w-20 animate-pulse rounded" />
      </Td>
      <Td>
        <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
      </Td>
      <Td>
        <div className="bg-muted h-5 w-24 animate-pulse rounded-full" />
      </Td>
      <Td>
        <div className="bg-muted h-7 w-7 animate-pulse rounded" />
      </Td>
    </Tr>
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
  onEditAccess,
}: MembersListProps): JSX.Element {
  return (
    <DataTable
      variant="bare"
      isLoading={isLoading}
      loadingLabel="Cargando miembros"
      loadingRows={Array.from({ length: 3 }).map((_, i) => (
        <MemberSkeletonRow key={i} />
      ))}
      isEmpty={members.length === 0}
      empty={{ text: 'No hay miembros' }}
      caption="Miembros del equipo"
      head={
        <>
          <Th>Nombre / Email</Th>
          <Th>Rol</Th>
          <Th>Estado</Th>
          <Th>Accesos</Th>
          <Th>Acciones</Th>
        </>
      }
    >
      {members.map((member) => (
        <Tr key={member.id}>
          <Td>
            <div className="font-medium">
              {member.fullName != null && member.fullName.length > 0
                ? member.fullName
                : member.email}
            </div>
            {member.fullName != null && member.fullName.length > 0 && (
              <div className="text-muted-foreground text-xs">{member.email}</div>
            )}
          </Td>
          <Td className="text-muted-foreground">{member.role}</Td>
          <Td>
            <MemberStatusBadge status={member.status} />
          </Td>
          <Td>
            <div className="flex flex-wrap items-center gap-1.5">
              {member.productRoles.length === 0 ? (
                // No role is not "no access": the resolver only narrows access
                // once a role exists, so this member sees the whole plan.
                <span className="text-muted-foreground text-xs">Todo el plan</span>
              ) : (
                member.productRoles.map((role) => (
                  <Badge key={role.id} variant="secondary" className="text-xs">
                    {role.name}
                  </Badge>
                ))
              )}
              {/* Outside the actions menu on purpose: that menu hides itself for
                  the current user, and a tenant whose admin is its only member
                  still has to be able to set their own access. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      onEditAccess(member.id);
                    }}
                    aria-label={`Editar accesos de ${member.email}`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar accesos</TooltipContent>
              </Tooltip>
            </div>
          </Td>
          <Td>
            <MemberActionsMenu
              memberId={member.id}
              memberEmail={member.email}
              currentStatus={member.status}
              isSelf={member.id === currentUserId}
              onSuspend={onSuspend}
              onActivate={onActivate}
              onDelete={onDelete}
            />
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
