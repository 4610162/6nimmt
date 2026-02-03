"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GameState } from "@/types/game";
import { Card } from "./Card";

interface GameBoardProps {
  state: GameState;
  myPlayerId: string | null;
  onPlayCard: (cardId: number) => void;
  onChooseRow?: (rowIndex: number) => void;
}

export function GameBoard({
  state,
  myPlayerId,
  onPlayCard,
  onChooseRow,
}: GameBoardProps) {
  const myPlayer = myPlayerId
    ? state.players.find((p) => p.id === myPlayerId)
    : null;
  const myHand = myPlayer?.hand ?? [];
  const tableRows = state.tableRows;
  const phase = state.phase;
  const turnInfo = state.turnInfo;
  const hasCommitted = myPlayerId
    ? !!turnInfo.playedCards[myPlayerId]
    : false;
  const isSelecting = phase === "selecting";
  const canPlayCard =
    isSelecting && myHand.length > 0 && !hasCommitted;
  const waitingForRowChoice =
    phase === "resolving" &&
    turnInfo.waitingForRowChoice === myPlayerId;

  const committedPlayerIds = turnInfo.committedPlayerIds ?? [];
  const placementOrder = state.placementOrder;

  const getCardOrderIndex = (cardId: number, rowIndex: number) => {
    if (!placementOrder) return -1;
    return placementOrder.findIndex(
      (s) => s.card.id === cardId && s.rowIndex === rowIndex
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-6">
      {/* 플레이어별 선택 상태 */}
      {isSelecting && (
        <div className="flex flex-wrap justify-center gap-2">
          {state.players.map((p) => {
            const committed = committedPlayerIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  committed
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
                    : "bg-slate-700/50 text-slate-400 border border-slate-600"
                } ${p.id === myPlayerId ? "ring-2 ring-emerald-400" : ""}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    committed ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                  }`}
                />
                {p.name}
                {committed ? (
                  <span className="text-xs text-emerald-400">✓</span>
                ) : (
                  <span className="text-xs text-amber-400">선택 중</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4개 카드 행 */}
      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <h2 className="text-lg font-semibold text-slate-300 text-center">
          테이블 · 턴 {turnInfo.turnNumber}/10 · 라운드 {state.currentRound}
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {tableRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex flex-wrap gap-2 min-h-[5rem] p-3 rounded-lg bg-slate-800/50 border border-slate-600"
            >
              {row.length === 0 ? (
                <span className="text-slate-500 text-sm self-center">
                  빈 행
                </span>
              ) : (
                row.map((card) => {
                  const orderIndex = getCardOrderIndex(card.id, rowIndex);
                  const isNewCard = placementOrder && orderIndex >= 0;
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={
                        isNewCard
                          ? {
                              opacity: 0,
                              y: 100,
                              scale: 0.3,
                            }
                          : false
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                        delay: isNewCard ? orderIndex * 0.1 : 0,
                      }}
                    >
                      <Card card={card} size="sm" />
                    </motion.div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 행 선택 (takeRow 시) */}
      {waitingForRowChoice && onChooseRow && (
        <div className="flex flex-col gap-3">
          <p className="text-amber-400 font-medium">
            카드가 모든 행보다 낮습니다. 가져갈 행을 선택하세요.
          </p>
          <div className="flex gap-3">
            {tableRows.map((_, rowIndex) => (
              <button
                key={rowIndex}
                type="button"
                onClick={() => onChooseRow(rowIndex)}
                className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition"
              >
                행 {rowIndex + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 내 손패 (10장) */}
      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-300">
            내 손패 {myHand.length}장
          </h2>
          {isSelecting && (
            <span className="text-sm text-slate-400">
              {turnInfo.committedCount ?? 0}/{state.players.length}명 선택 완료
            </span>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2 p-4 rounded-xl bg-slate-800/30 border border-slate-700">
          {myHand
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((card) => (
              <Card
                key={card.id}
                card={card}
                size="md"
                onClick={() => onPlayCard(card.id)}
                disabled={!canPlayCard}
                selected={turnInfo.playedCards[myPlayerId ?? ""]?.id === card.id}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
