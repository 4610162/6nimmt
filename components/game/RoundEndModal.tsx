"use client";

import { motion } from "framer-motion";
import type { GameState, Player } from "@/types/game";

interface RoundEndModalProps {
  state: GameState;
  myPlayerId: string | null;
  onDismiss?: () => void;
}

export function RoundEndModal({
  state,
  myPlayerId,
  onDismiss,
}: RoundEndModalProps) {
  const rankedPlayers = [...state.players].sort(
    (a, b) => a.score - b.score
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl overflow-hidden"
      >
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold text-amber-400 mb-1">
            라운드 {state.currentRound - 1} 종료
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            현재까지 벌점 순위
          </p>

          <div className="space-y-2">
            {rankedPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                  i === 0
                    ? "bg-amber-500/20 border border-amber-500/50"
                    : "bg-slate-700/50"
                } ${player.id === myPlayerId ? "ring-2 ring-emerald-500" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-bold w-8 ${
                      i === 0 ? "text-amber-400" : "text-slate-400"
                    }`}
                  >
                    {i + 1}위
                  </span>
                  <span className="text-white font-medium">
                    {player.name}
                    {player.id === myPlayerId && (
                      <span className="ml-1 text-xs text-emerald-400">
                        (나)
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-slate-300 font-semibold">
                  {player.score}점
                </span>
              </motion.div>
            ))}
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-6 w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
            >
              다음 라운드
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
