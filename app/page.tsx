"use client";

import { useRouter } from "next/navigation";

function generateRoomId(): string {
  return "room-" + (1000 + Math.floor(Math.random() * 9000));
}

export default function Home() {
  const router = useRouter();

  const handleNewGame = () => {
    const roomId = generateRoomId();
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-slate-800/50 p-8 border border-slate-600">
        <h1 className="text-2xl font-bold text-white text-center">
          6 nimmt!
        </h1>
        <p className="text-slate-400 text-center text-sm">
          실시간 멀티플레이 보드게임
        </p>
        <button
          type="button"
          onClick={handleNewGame}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
        >
          새 게임 시작
        </button>
      </div>
    </main>
  );
}
