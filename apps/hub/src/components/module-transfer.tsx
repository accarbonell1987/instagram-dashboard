'use client';

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@core/ui/lib';
import { GripVertical } from 'lucide-react';
import { useState, type JSX } from 'react';

import { moduleVisuals } from '@/lib/apps-config';

export interface ModuleItem {
  id: string;
  name: string;
  parentId: string | null;
}

interface ModuleTransferProps {
  available: ModuleItem[];
  assigned: ModuleItem[];
  onAssign: (moduleId: string) => void;
  onUnassign: (moduleId: string) => void;
  className?: string;
}

const CONTAINER_AVAILABLE = 'available';
const CONTAINER_ASSIGNED = 'assigned';

function SortableModule({
  module,
  isAssigned,
  onRemove,
}: {
  module: ModuleItem;
  isAssigned: boolean;
  onRemove?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `${isAssigned ? 'assigned' : 'available'}-${module.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const Icon = moduleVisuals[module.id]?.icon;
  const isChild = module.parentId !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
        isChild && 'ml-5 border-dashed',
        isDragging && 'shadow-lg',
      )}
    >
      <button
        type="button"
        aria-label={`Arrastrar ${module.name}`}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      {Icon !== undefined && <Icon className="text-muted-foreground h-4 w-4 shrink-0" />}
      <span className="flex-1 truncate">{module.name}</span>
      {isAssigned && onRemove !== undefined && (
        <button
          type="button"
          aria-label={`Quitar ${module.name}`}
          onClick={() => { onRemove(module.id); }}
          className="text-muted-foreground hover:text-destructive ml-auto text-xs"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function ModuleTransfer({
  available,
  assigned,
  onAssign,
  onUnassign,
  className,
}: ModuleTransferProps): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assignedIds = assigned.map((m) => `assigned-${m.id}`);
  const availableIds = available.map((m) => `available-${m.id}`);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine source and target containers
    const fromAssigned = activeId.startsWith('assigned-');
    const toAssigned =
      overId.startsWith('assigned-') || overId === CONTAINER_ASSIGNED;

    if (fromAssigned === toAssigned) return; // same container, no-op

    const moduleId = activeId.replace(/^(available|assigned)-/, '');
    if (fromAssigned) {
      onUnassign(moduleId);
    } else {
      onAssign(moduleId);
    }
  }

  const activeModule = activeId
    ? [...available, ...assigned].find((m) => activeId.endsWith(m.id)) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn('grid grid-cols-2 gap-4', className)}>
        {/* Available column */}
        <div>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
            Disponibles ({available.length})
          </h4>
          <div
            id={CONTAINER_AVAILABLE}
            className="bg-muted/30 min-h-[100px] space-y-1 rounded-lg border p-2"
          >
            <SortableContext items={availableIds} strategy={verticalListSortingStrategy}>
              {available.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">Todos asignados</p>
              ) : (
                available.map((m) => (
                  <SortableModule key={m.id} module={m} isAssigned={false} />
                ))
              )}
            </SortableContext>
          </div>
        </div>

        {/* Assigned column */}
        <div>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
            Asignados ({assigned.length})
          </h4>
          <div
            id={CONTAINER_ASSIGNED}
            className="bg-muted/30 min-h-[100px] space-y-1 rounded-lg border p-2"
          >
            <SortableContext items={assignedIds} strategy={verticalListSortingStrategy}>
              {assigned.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  Arrastrá módulos aquí
                </p>
              ) : (
                assigned.map((m) => (
                  <SortableModule
                    key={m.id}
                    module={m}
                    isAssigned
                    onRemove={onUnassign}
                  />
                ))
              )}
            </SortableContext>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeModule !== null ? (
          <div className="bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-xl">
            <GripVertical className="text-muted-foreground h-4 w-4" />
            <span>{activeModule.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
