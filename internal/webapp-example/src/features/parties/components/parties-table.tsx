'use client';

import { Badge, Button } from '@core/ui';
import { BuildingIcon, PencilIcon, TrashIcon, UserIcon } from 'lucide-react';

import type { Party, PartyType } from '../parties.types';

import { DataTable } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';

export interface PartiesTableProps {
  /** Parties to display */
  parties: Party[];
  /** Whether data is loading */
  loading: boolean;
  /** Callback when edit button is clicked */
  onEdit: (party: Party) => void;
  /** Callback when delete button is clicked */
  onDelete: (party: Party) => void;
}

function TypeBadge({ type }: { type: PartyType }) {
  const isPerson = type === 'person';
  return (
    <Badge variant={isPerson ? 'secondary' : 'default'} className="gap-1">
      {isPerson ? <UserIcon className="h-3 w-3" /> : <BuildingIcon className="h-3 w-3" />}
      {isPerson ? 'Person' : 'Organization'}
    </Badge>
  );
}

export function PartiesTable({ parties, loading, onEdit, onDelete }: PartiesTableProps) {
  const columns: DataTableColumn<Party>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 'w-16',
      render: (party) => (
        <span className="text-muted-foreground font-mono text-sm">{party.id}</span>
      ),
    },
    {
      key: 'displayName',
      header: 'Display Name',
      render: (party) => <span className="font-medium">{party.displayName}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      width: 'w-32',
      render: (party) => <TypeBadge type={party.type} />,
    },
    {
      key: 'email',
      header: 'Email',
      render: (party) => <span className="text-muted-foreground">{party.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (party) => <span className="text-muted-foreground">{party.phone ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 'w-40',
      render: (party) => (
        <span className="text-muted-foreground text-sm">
          {new Date(party.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 'w-24',
      align: 'right',
      render: (party) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onEdit(party);
            }}
            aria-label={`Edit ${party.displayName}`}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onDelete(party);
            }}
            aria-label={`Delete ${party.displayName}`}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      items={parties}
      columns={columns}
      getRowKey={(party) => party.id}
      loading={loading}
      emptyMessage="No parties found."
    />
  );
}
