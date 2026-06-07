import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative cursor-grab rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[0_10px_20px_rgba(3,33,71,0.06)]",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-[rgba(32,157,215,0.45)] hover:shadow-[0_16px_30px_rgba(3,33,71,0.12)]",
        isDragging && "cursor-grabbing opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onDelete(card.id)}
        aria-label={`Delete ${card.title}`}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)]"
      >
        <span aria-hidden="true">&times;</span>
      </button>

      <h4 className="pr-7 font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
        {card.title}
      </h4>
      {card.details && (
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
          {card.details}
        </p>
      )}
    </article>
  );
};
