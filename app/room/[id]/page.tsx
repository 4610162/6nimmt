"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import usePartySocket from "partysocket/react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState } from "@/types/game";
import { GameBoard } from "@/components/game/GameBoard";
import { ResultModal } from "@/components/game/ResultModal";
import { RoundEndModal } from "@/components/game/RoundEndModal";

// 로컬: 미설정 시 localhost:1999. 배포: Vercel에서 NEXT_PUBLIC_PARTYKIT_HOST에 PartyKit Cloud 호스트 설정
const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

export default function RoomPage() {
  const params = useParams();
  const roomId = (params?.id as string) ?? "default";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [turnPenalty, setTurnPenalty] = useState<number | null>(null);
  const [roundEndState, setRoundEndState] = useState<GameState | null>(null);

  const prevScoreRef = useRef<number | null>(null);
  const roundEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    party: "main",
    onMessage(event) {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "state" && msg.state) {
          const state = msg.state as GameState;

          if (state.phase === "roundEnd") {
            setRoundEndState(state);
            if (roundEndTimerRef.current) clearTimeout(roundEndTimerRef.current);
            roundEndTimerRef.current = setTimeout(() => {
              setRoundEndState(null);
              roundEndTimerRef.current = null;
            }, 5000);
          }

          const myId = socket.id ?? null;
          if (state.placementOrder && myId) {
            const me = state.players.find((p) => p.id === myId);
            const prev = prevScoreRef.current ?? 0;
            if (me != null && me.score > prev) {
              setTurnPenalty(me.score - prev);
              setTimeout(() => setTurnPenalty(null), 2500);
            }
            prevScoreRef.current = me?.score ?? null;
          } else if (myId) {
            const me = state.players.find((p) => p.id === myId);
            prevScoreRef.current = me?.score ?? null;
          }

          setGameState(state);
          setErrorMessage(null);
        }
        if (msg.type === "error") {
          setErrorMessage(msg.message ?? "오류가 발생했습니다.");
          console.error("Server error:", msg.message);
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    },
  });

  const connectionId = socket.id ?? null;

  useEffect(() => {
    return () => {
      if (roundEndTimerRef.current) clearTimeout(roundEndTimerRef.current);
    };
  }, []);

  const handleJoin = useCallback(() => {
    if (!playerName.trim()) return;
    setErrorMessage(null);
    socket.send(
      JSON.stringify({ type: "join", name: playerName.trim() })
    );
    setHasJoined(true);
  }, [playerName, socket]);

  const handleStartGame = useCallback(() => {
    socket.send(JSON.stringify({ type: "startGame" }));
  }, [socket]);

  const handlePlayCard = useCallback(
    (cardId: number) => {
      socket.send(JSON.stringify({ type: "playCard", cardId }));
    },
    [socket]
  );

  const handleChooseRow = useCallback(
    (rowIndex: number) => {
      socket.send(JSON.stringify({ type: "chooseRow", rowIndex }));
    },
    [socket]
  );

  const handleCopyInviteLink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, []);

  if (!gameState) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-slate-400">서버에 연결 중...</div>
        <div className="mt-2 text-sm text-slate-500">
          {PARTYKIT_HOST === "localhost:1999"
            ? "로컬: PartyKit이 localhost:1999에서 실행 중인지 확인하세요."
            : `연결 대상: ${PARTYKIT_HOST}`}
        </div>
      </main>
    );
  }

  if (gameState.phase === "waiting" && !hasJoined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-4 rounded-xl bg-slate-800/50 p-6 border border-slate-600">
          <h1 className="text-xl font-bold text-white text-center">
            6 nimmt!
          </h1>
          {errorMessage && (
            <div className="px-3 py-2 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
              {errorMessage}
            </div>
          )}
          <input
            type="text"
            placeholder="닉네임 입력"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={!playerName.trim()}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition"
          >
            입장
          </button>
        </div>
      </main>
    );
  }

  if (gameState.phase === "waiting") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 rounded-xl bg-slate-800/50 p-6 border border-slate-600">
          <h1 className="text-xl font-bold text-white text-center">
            대기실
          </h1>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
          >
            {copySuccess ? "복사됨!" : "초대 링크 복사"}
          </button>
          <p className="text-slate-400 text-center text-sm">
            플레이어 {gameState.players.length}명 · 최소 2명 필요 (최대 10명)
          </p>
          <ul className="space-y-1 text-slate-300">
            {gameState.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${p.connected ? "bg-emerald-500" : "bg-slate-500"}`}
                />
                {p.name}
                {p.id === connectionId && (
                  <span className="text-xs text-emerald-400">(나)</span>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleStartGame}
            disabled={gameState.players.filter((p) => p.connected).length < 2}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold transition"
          >
            게임 시작
          </button>
        </div>
      </main>
    );
  }

  const headerContent = (
    <header className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
      <h1 className="text-lg font-bold text-white">6 nimmt!</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCopyInviteLink}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
        >
          {copySuccess ? "복사됨!" : "초대 링크 복사"}
        </button>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${socket.readyState === 1 ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {socket.readyState === 1 ? "연결됨" : "연결 중..."}
        </div>
      </div>
    </header>
  );

  if (gameState.phase === "gameEnd") {
    return (
      <main className="flex min-h-screen flex-col">
        {headerContent}
        <div className="flex-1 flex items-center justify-center opacity-30">
          <GameBoard
            state={gameState}
            myPlayerId={connectionId}
            onPlayCard={() => {}}
          />
        </div>
        <ResultModal state={gameState} myPlayerId={connectionId} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      {headerContent}
      <GameBoard
        state={gameState}
        myPlayerId={connectionId}
        onPlayCard={handlePlayCard}
        onChooseRow={handleChooseRow}
      />

      <AnimatePresence>
        {turnPenalty != null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-6 py-3 rounded-xl bg-amber-500/95 text-slate-900 font-bold shadow-lg"
          >
            이번 턴 벌점: +{turnPenalty}점
          </motion.div>
        )}
      </AnimatePresence>

      {roundEndState && (
        <RoundEndModal
          state={roundEndState}
          myPlayerId={connectionId}
          onDismiss={() => {
            setRoundEndState(null);
            if (roundEndTimerRef.current) {
              clearTimeout(roundEndTimerRef.current);
              roundEndTimerRef.current = null;
            }
          }}
        />
      )}
    </main>
  );
}
