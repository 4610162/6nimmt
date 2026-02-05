"use client";

import { motion } from "framer-motion";
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
  /** 뒷면(숫자 비공개) 표시 — 공개 연출용 */
  faceDown?: boolean;
  /** 선택된 카드 하이라이트(가시성) */
  highlight?: boolean;
}

export function Card({
  card,
  size = "md",
  onClick,
  disabled = false,
  selected = false,
  faceDown = false,
  highlight = false,
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

  const showHighlight = selected || highlight;

  return (
    <motion.div
      className="relative"
      style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
      animate={{ rotateY: faceDown ? 180 : 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`
          relative ${sizeClass}
          rounded-lg border-2 shadow-md
          flex flex-col items-center justify-center gap-0.5 overflow-hidden
          transition-all duration-150
          ${onClick && !disabled ? "cursor-pointer hover:scale-105 hover:shadow-lg" : ""}
          ${disabled ? "opacity-60 cursor-not-allowed" : ""}
          ${showHighlight ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 scale-105 shadow-xl shadow-amber-500/20" : ""}
        `}
      >
        {/* 하이라이트: 선택/강조 시 카드 주변 글로우 */}
        {showHighlight && (
          <span
            className="absolute inset-0 rounded-lg pointer-events-none z-10"
            style={{
              boxShadow: "inset 0 0 0 2px rgba(251, 191, 36, 0.6), 0 0 20px rgba(251, 191, 36, 0.25)",
            }}
            aria-hidden
          />
        )}

        {/* 뒷면 (rotateY 180일 때 보이도록) */}
        <span
          className="absolute inset-0 rounded-lg bg-slate-600 border-2 border-slate-500 flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <span className="text-slate-400 text-lg font-bold">?</span>
        </span>

        {/* 앞면 (숫자·벌점) */}
        <span
          className={`absolute inset-0 rounded-lg ${bgClass} border-2 flex flex-col items-center justify-center gap-0.5`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className={`font-bold ${numberColor} drop-shadow-sm`}>
            {card.id}
          </span>
          <span className={`${penaltySize} ${numberColor} flex items-center justify-center min-w-0`}>
            <PenaltyBombs count={card.bullHeads} />
          </span>
        </span>
      </button>
    </motion.div>
  );
}
