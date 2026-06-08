import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type CardContentProps = {
  card: Card;
  // Leaves room for the board card's absolutely-positioned delete button.
  titlePadding?: boolean;
};

// Title and details, shared by the board card and its drag preview.
export const CardContent = ({ card, titlePadding = false }: CardContentProps) => (
  <>
    <h4
      className={clsx(
        "font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]",
        titlePadding && "pr-7"
      )}
    >
      {card.title}
    </h4>
    {card.details && (
      <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
        {card.details}
      </p>
    )}
  </>
);
