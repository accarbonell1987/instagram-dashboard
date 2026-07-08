'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/ui';
import { MoreHorizontal } from 'lucide-react';
import type { JSX } from 'react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MemberActionsMenuProps {
  memberId: string;
  memberEmail: string;
  currentStatus: 'pending_first_login' | 'active' | 'suspended';
  isSelf: boolean;
  onSuspend: (memberId: string) => void;
  onActivate: (memberId: string) => void;
  onDelete: (memberId: string, email: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MemberActionsMenu({
  memberId,
  memberEmail,
  currentStatus,
  isSelf,
  onSuspend,
  onActivate,
  onDelete,
}: MemberActionsMenuProps): JSX.Element | null {
  if (isSelf) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${memberEmail}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentStatus === 'suspended' && (
          <DropdownMenuItem
            onClick={() => {
              onActivate(memberId);
            }}
          >
            Activar acceso
          </DropdownMenuItem>
        )}
        {(currentStatus === 'active' || currentStatus === 'pending_first_login') && (
          <DropdownMenuItem
            onClick={() => {
              onSuspend(memberId);
            }}
          >
            Suspender acceso
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            onDelete(memberId, memberEmail);
          }}
        >
          Eliminar miembro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
