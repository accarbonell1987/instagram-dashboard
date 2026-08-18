'use client';

import { Badge, Button, DataTable, Td, Th, Tr } from '@core/ui';
import { BuildingIcon, PencilIcon, TrashIcon, UserIcon } from 'lucide-react';

import type { Party, PartyType } from '../parties.types';

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
  return (
    <DataTable
      isLoading={loading}
      isEmpty={parties.length === 0}
      empty={{ text: 'No parties found.' }}
      caption="Parties"
      head={
        <>
          <Th width="w-16">ID</Th>
          <Th>Display Name</Th>
          <Th width="w-32">Type</Th>
          <Th>Email</Th>
          <Th>Phone</Th>
          <Th width="w-40">Created</Th>
          <Th width="w-24" align="right">
            Actions
          </Th>
        </>
      }
    >
      {parties.map((party) => (
        <Tr key={party.id}>
          <Td className="text-muted-foreground font-mono text-sm">{party.id}</Td>
          <Td className="font-medium">{party.displayName}</Td>
          <Td>
            <TypeBadge type={party.type} />
          </Td>
          <Td className="text-muted-foreground">{party.email ?? '—'}</Td>
          <Td className="text-muted-foreground">{party.phone ?? '—'}</Td>
          <Td className="text-muted-foreground text-sm">
            {new Date(party.createdAt).toLocaleDateString()}
          </Td>
          <Td align="right">
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
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
