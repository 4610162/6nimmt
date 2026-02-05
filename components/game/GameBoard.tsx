"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState, PlacementStep } from "@/types/game";
import { Card } from "./Card";

interface GameBoardProps {
  state: GameState;
  myPlayerId: string | null;
  onPlayCard: (cardId: number) => void;
  onChooseRow?: (rowIndex: number) => void;
}

type RevealPhase = "idle" | "strip" | "flipped" | "done";

/** placementOrder 기준 이 턴의 고유 키 */
function getPlacementKey(order: PlacementStep[] | undefined): string {
  if (!order?.length) return "";
  return order.map((s) => `${s.card.id}-${s.rowIndex}`).join(",");
}

/** 테이블 행에서 이번 턴 새로 추가된 카드만 제외한 행 배열 */
function tableRowsWithoutNewCards(
  tableRows: GameState["tableRows"],
  placementOrder: GameState["placementOrder"]
): GameState["tableRows"] {
  if (!placementOrder?.length) return tableRows;
  const newKeys = new Set(
    placementOrder.map((s) => `${s.card.id}-${s.rowIndex}`)
  );
  return tableRows.map((row, rowIndex) =>
    row.filter((card) => !newKeys.has(`${card.id}-${rowIndex}`))
  );
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

  const [revealPhase, setRevealPhase] = useState<RevealPhase>("idle");
  const placementKeyRef = useRef<string>("");

  const currentKey = getPlacementKey(placementOrder);

  useEffect(() => {
    if (!placementOrder?.length) {
      if (revealPhase === "done") placementKeyRef.current = "";
      return;
    }
    if (placementKeyRef.current === currentKey) return;
    placementKeyRef.current = currentKey;
    setRevealPhase("strip");
  }, [currentKey, placementOrder, revealPhase]);

  useEffect(() => {
    if (revealPhase === "strip") {
      const t = setTimeout(() => setRevealPhase("flipped"), 600);
      return () => clearTimeout(t);
    }
    if (revealPhase === "flipped") {
      const t = setTimeout(() => setRevealPhase("done"), 1200);
      return () => clearTimeout(t);
    }
  }, [revealPhase]);

  const isRevealing = revealPhase === "strip" || revealPhase === "flipped";
  const displayTableRows =
    placementOrder?.length && isRevealing
      ? tableRowsWithoutNewCards(tableRows, placementOrder)
      : tableRows;

  const getCardOrderIndex = (cardId: number, rowIndex: number) => {
    if (!placementOrder) return -1;
    return placementOrder.findIndex(
      (s) => s.card.id === cardId && s.rowIndex === rowIndex
    );
  };

  const cardsToReveal = placementOrder ?? [];

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-6">
      {/* 공개 연출: 모든 플레이어 제출 후 카드 동시 뒤집기 */}
      <AnimatePresence>
        {cardsToReveal.length > 0 && isRevealing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-wrap justify-center gap-3 p-6 rounded-2xl bg-slate-800/95 border border-slate-600 shadow-2xl max-w-2xl"
            >
              <p className="w-full text-center text-slate-300 text-sm mb-2">
                {revealPhase === "strip" ? "카드 공개..." : "낮은 숫자부터 보드에 배치됩니다"}
              </p>
              {cardsToReveal.map((step, index) => (
                <motion.div
                  key={`${step.card.id}-${step.rowIndex}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card
                    card={step.card}
                    size="md"
                    faceDown={revealPhase === "strip"}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                {p.connected === false ? (
                  <span className="text-xs text-slate-500">(이탈)</span>
                ) : committed ? (
                  <span className="text-xs text-emerald-400">✓</span>
                ) : (
                  <span className="text-xs text-amber-400">선택 중</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4개 카드 행 — 낮은 숫자부터 순차 배치 애니메이션 */}
      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <h2 className="text-lg font-semibold text-slate-300 text-center">
          테이블 · 턴 {turnInfo.turnNumber}/10 · 라운드 {state.currentRound}
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {displayTableRows.map((row, rowIndex) => (
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
                  const isNewCard = placementOrder && orderIndex >= 0 && !isRevealing;
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={
                        isNewCard
                          ? {
                              opacity: 0,
                              y: 80,
                              scale: 0.4,
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
                        stiffness: 280,
                        damping: 22,
                        delay: isNewCard ? orderIndex * 0.12 : 0,
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

      {/* 내 손패 — 선택된 카드 하이라이트 */}
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
                highlight={turnInfo.playedCards[myPlayerId ?? ""]?.id === card.id}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
