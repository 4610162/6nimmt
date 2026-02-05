"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RulebookModal } from "@/components/RulebookModal";

interface RoomWithCount {
  roomId: string;
  title: string;
  createdAt: number;
  maxPlayers: number;
  currentPlayers: number;
}

export default function Home() {
  const router = useRouter();
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch rooms", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "방 만들기 실패");
        return;
      }
      const data = await res.json();
      router.push(`/room/${data.roomId}`);
    } catch (e) {
      console.error(e);
      alert("방 만들기에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleEnterRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "입장 실패");
        return;
      }
      router.push(`/room/${roomId}`);
    } catch (e) {
      console.error(e);
      alert("입장에 실패했습니다.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-8 bg-slate-950">
      <div className="w-full max-w-2xl space-y-6">
        <div className="rounded-xl bg-slate-800/50 p-6 border border-slate-600">
          <h1 className="text-2xl font-bold text-white text-center">
            6 nimmt!
          </h1>
          <p className="text-slate-400 text-center text-sm mt-1">
            실시간 멀티플레이 보드게임
          </p>

          <div className="mt-6 flex gap-2">
            <input
              type="text"
              placeholder="방 제목 (선택)"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={creating}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
            >
              {creating ? "만드는 중..." : "방 만들기"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRulebookOpen(true)}
            className="mt-3 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition border border-slate-600"
          >
            규칙서 보기
          </button>
        </div>

        <section className="rounded-xl bg-slate-800/50 p-6 border border-slate-600">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            공개 대기실
          </h2>
          {loading ? (
            <p className="text-slate-500 text-sm">방 목록 불러오는 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-slate-500 text-sm">생성된 방이 없습니다. 방을 만들어 보세요.</p>
          ) : (
            <ul className="space-y-3">
              {rooms.map((room, index) => (
                <motion.li
                  key={room.roomId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-700/50 border border-slate-600 hover:border-slate-500 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {room.title || "무제"}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {room.currentPlayers} / {room.maxPlayers}명
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEnterRoom(room.roomId)}
                    disabled={room.currentPlayers >= room.maxPlayers}
                    className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium transition"
                  >
                    입장하기
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <RulebookModal
        isOpen={isRulebookOpen}
        onClose={() => setIsRulebookOpen(false)}
      />
    </main>
  );
}
