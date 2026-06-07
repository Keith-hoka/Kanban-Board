import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
      {card.title}
    </h4>
    {card.details && (
      <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
        {card.details}
      </p>
    )}
  </article>
);
