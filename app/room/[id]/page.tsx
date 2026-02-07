"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const roomId = (params?.id as string) ?? "default";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnPenalty, setTurnPenalty] = useState<number | null>(null);
  const [roundEndState, setRoundEndState] = useState<GameState | null>(null);
  const [connectionIdFromServer, setConnectionIdFromServer] = useState<string | null>(null);

  const prevScoreRef = useRef<number | null>(null);
  const roundEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionIdRef = useRef<string | null>(null);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    party: "main",
    onMessage(event) {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "stateWithConnectionId" && msg.state != null) {
          const state = msg.state as GameState;
          const id = typeof msg.yourConnectionId === "string" ? msg.yourConnectionId : "";
          connectionIdRef.current = id || null;
          setConnectionIdFromServer(id || null);
          if (state.phase === "roundEnd") {
            setRoundEndState(state);
            if (roundEndTimerRef.current) clearTimeout(roundEndTimerRef.current);
            roundEndTimerRef.current = setTimeout(() => {
              setRoundEndState(null);
              roundEndTimerRef.current = null;
            }, 5000);
          }
          const myId = id || (connectionIdRef.current ?? null);
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
          return;
        }

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

          const myId = connectionIdRef.current ?? socket.id ?? null;
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
        if (msg.type === "yourConnectionId" && typeof msg.id === "string") {
          connectionIdRef.current = msg.id;
          setConnectionIdFromServer(msg.id);
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    },
  });

  const connectionId = connectionIdFromServer ?? socket.id ?? null;

  useEffect(() => {
    return () => {
      if (roundEndTimerRef.current) clearTimeout(roundEndTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST" }).catch(() => {});
    return () => {
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" }).catch(() => {});
    };
  }, [roomId]);

  // 연결 직후 세션 ID를 서버에 등록 → 탭/이탈 시 onClose에서 Redis leave 호출로 방 삭제 가능
  useEffect(() => {
    if (socket.readyState !== 1) return;
    let cancelled = false;
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.sessionId) return;
        socket.send(JSON.stringify({ type: "setSessionId", sessionId: data.sessionId }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [socket, socket.readyState]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) return;
    setErrorMessage(null);
    let sessionId: string | undefined;
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        sessionId = data.sessionId ?? undefined;
      }
    } catch {
      // ignore
    }
    socket.send(
      JSON.stringify({ type: "join", name: playerName.trim(), sessionId })
    );
    setHasJoined(true);
  }, [playerName, socket]);

  const handleStartGame = useCallback(() => {
    socket.send(JSON.stringify({ type: "startGame" }));
  }, [socket]);

  const handleReady = useCallback(() => {
    socket.send(JSON.stringify({ type: "ready" }));
  }, [socket]);

  const handleUnready = useCallback(() => {
    socket.send(JSON.stringify({ type: "unready" }));
  }, [socket]);

  const handleAddBot = useCallback(() => {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "addBot" }));
  }, [socket]);

  const handleLeaveAfterGame = useCallback(() => {
    router.push("/");
  }, [router]);

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
    const humanPlayers = gameState.players.filter((p) => !p.isBot);
    const isHost =
      gameState.hostId === connectionId ||
      (humanPlayers.length === 1 && connectionId !== null && humanPlayers.some((p) => p.id === connectionId));
    const botCount = gameState.players.filter((p) => p.isBot).length;
    const allNonHostReady = humanPlayers.every(
      (p) => p.id === gameState.hostId || p.isReady === true
    );
    const canStart =
      isHost &&
      gameState.players.length >= 2 &&
      allNonHostReady;
    const canAddBot =
      connectionId !== null &&
      botCount < 9 &&
      gameState.players.length < 10 &&
      socket.readyState === 1;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 rounded-xl bg-slate-800/50 p-6 border border-slate-600">
          <h1 className="text-xl font-bold text-white text-center">
            대기실
          </h1>
          <p className="text-slate-400 text-center text-sm">
            플레이어 {gameState.players.length}명 · 최소 2명 필요 (최대 10명, 봇 최대 9명)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddBot}
              disabled={!canAddBot}
              className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-200 text-sm font-medium transition"
            >
              봇 추가
            </button>
          </div>
          <ul className="space-y-1 text-slate-300">
            {gameState.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 flex-wrap">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    p.connected ? "bg-emerald-500" : "bg-slate-500"
                  } ${p.isReady ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-800" : ""}`}
                />
                {p.name}
                {p.isBot && <span className="text-xs text-slate-500">(봇)</span>}
                {p.id === gameState.hostId && (
                  <span className="text-xs text-amber-400">(방장)</span>
                )}
                {p.connected === false && (
                  <span className="text-xs text-slate-500">(이탈→봇)</span>
                )}
                {p.id === connectionId && (
                  <span className="text-xs text-emerald-400">(나)</span>
                )}
                {!p.isBot && p.id === connectionId && p.id !== gameState.hostId && (
                  <span className="ml-auto">
                    {p.isReady ? (
                      <button
                        type="button"
                        onClick={handleUnready}
                        className="text-xs px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white"
                      >
                        취소
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReady}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        준비
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button
              type="button"
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold transition"
            >
              {allNonHostReady ? "게임 시작" : "모든 플레이어 준비 시 시작 가능"}
            </button>
          ) : (
            <p className="text-slate-400 text-center text-sm">
              방장이 모든 플레이어 준비 시 게임을 시작합니다.
            </p>
          )}
        </div>
      </main>
    );
  }

  const headerContent = (
    <header className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
      <h1 className="text-lg font-bold text-white">6 nimmt!</h1>
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${socket.readyState === 1 ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {socket.readyState === 1 ? "연결됨" : "연결 중..."}
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
        <ResultModal
          state={gameState}
          myPlayerId={connectionId}
          onClose={handleLeaveAfterGame}
        />
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
