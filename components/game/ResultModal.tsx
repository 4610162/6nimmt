"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GameState, Player } from "@/types/game";

interface ResultModalProps {
  state: GameState;
  myPlayerId: string | null;
  onClose?: () => void;
}

export function ResultModal({
  state,
  myPlayerId,
  onClose,
}: ResultModalProps) {
  const winner = state.players.find((p) => p.id === state.winner);
  const rankedPlayers = [...state.players].sort(
    (a, b) => a.score - b.score
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 text-center">
            <motion.h1
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold text-amber-400 mb-1"
            >
              게임 종료!
            </motion.h1>
            <motion.p
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white text-lg mb-6"
            >
              승자: <span className="font-semibold">{winner?.name ?? "?"}</span>
            </motion.p>

            <div className="space-y-2">
              {rankedPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
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

            {onClose && (
              <motion.button
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                type="button"
                onClick={onClose}
                className="mt-6 w-full py-3 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium transition"
              >
                나가기
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
