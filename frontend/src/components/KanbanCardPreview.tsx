import type { Card } from "@/lib/kanban";
import { CardContent } from "@/components/CardContent";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <CardContent card={card} />
  </article>
);
