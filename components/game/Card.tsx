"use client";

import type { Card as CardType } from "@/types/game";

/** 벌점 개수별 카드 배경색 (1: 초록, 2: 노랑, 3: 주황, 5+: 빨강) */
const PENALTY_BG: Record<number, string> = {
  1: "bg-emerald-500 border-emerald-400 text-white",
  2: "bg-yellow-400 border-yellow-500 text-slate-900",
  3: "bg-orange-400 border-orange-500 text-slate-900",
  4: "bg-amber-400 border-amber-500 text-slate-900",
  5: "bg-red-500 border-red-400 text-white",
  6: "bg-red-600 border-red-500 text-white",
  7: "bg-rose-600 border-rose-500 text-white",
};

function getPenaltyBg(bullHeads: number): string {
  return PENALTY_BG[bullHeads] ?? PENALTY_BG[1];
}

/** 폭탄(벌점) 표시 - 넘침 방지: 폭탄 1개 + 숫자 */
function PenaltyBombs({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center gap-0.5 min-w-0 shrink"
      title={`벌점 ${count}점`}
    >
      <span className="leading-none shrink-0" aria-hidden>
        💣
      </span>
      <span className="tabular-nums leading-none" aria-hidden>
        {count}
      </span>
    </span>
  );
}

interface CardProps {
  card: CardType;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export function Card({
  card,
  size = "md",
  onClick,
  disabled = false,
  selected = false,
}: CardProps) {
  const sizeClass =
    size === "sm"
      ? "w-12 h-16 text-sm"
      : size === "md"
        ? "w-14 h-20 text-base"
        : "w-16 h-24 text-lg";

  const penaltySize =
    size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm";

  const bgClass = getPenaltyBg(card.bullHeads);
  const isLightBg = card.bullHeads >= 2 && card.bullHeads <= 4;
  const numberColor = isLightBg ? "text-slate-900" : "text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        ${bgClass} ${sizeClass}
        rounded-lg border-2 shadow-md
        flex flex-col items-center justify-center gap-0.5 overflow-hidden
        transition-all duration-150
        ${onClick && !disabled ? "cursor-pointer hover:scale-105 hover:shadow-lg" : ""}
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        ${selected ? "ring-4 ring-white scale-105 shadow-xl" : ""}
      `}
    >
      <span className={`font-bold ${numberColor} drop-shadow-sm`}>
        {card.id}
      </span>
      <span className={`${penaltySize} ${numberColor} flex items-center justify-center min-w-0`}>
        <PenaltyBombs count={card.bullHeads} />
      </span>
    </button>
  );
}
