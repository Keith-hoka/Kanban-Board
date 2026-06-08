"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

// Drop onto whatever the pointer is over, so a card lands in the column the
// cursor is in (more forgiving than corner-distance for narrow columns). Fall
// back to rectangle overlap when the pointer sits in a gap between droppables.
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

type KanbanBoardProps = {
  initialBoard?: BoardData;
  onChange?: (board: BoardData) => void;
  onLogout?: () => void;
  sidebar?: ReactNode;
};

export const KanbanBoard = ({
  initialBoard = initialData,
  onChange,
  onLogout,
  sidebar,
}: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialBoard);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  // Notify the parent of every board change (skipping the initial render) so it
  // can persist. Kept in a ref so an inline onChange does not retrigger saves.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    onChangeRef.current?.(board);
  }, [board]);

  // Apply an externally-replaced board (e.g. an AI edit) without remounting, so
  // the chat sidebar's state survives a board refresh. The parent suppresses the
  // resulting save (the server already has this board).
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
    setActiveWidth(event.active.rect.current.initial?.width ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    setActiveWidth(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleAddColumn = () => {
    const id = createId("col");
    setBoard((prev) => ({
      ...prev,
      columns: [...prev.columns, { id, title: "New Column", cardIds: [] }],
    }));
  };

  const handleDeleteColumn = (columnId: string) => {
    setBoard((prev) => {
      const column = prev.columns.find((item) => item.id === columnId);
      if (!column) {
        return prev;
      }
      const removedCardIds = new Set(column.cardIds);
      return {
        columns: prev.columns.filter((item) => item.id !== columnId),
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => !removedCardIds.has(id))
        ),
      };
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  Log out
                </button>
              )}
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddColumn}
              aria-label="Add column"
              className="flex items-center gap-2 rounded-full border border-dashed border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
            >
              <span aria-hidden="true" className="text-base leading-none">
                +
              </span>
              Add column
            </button>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <section className="grid min-w-0 flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}
            </section>
            {sidebar}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div style={{ width: activeWidth ?? undefined }}>
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
