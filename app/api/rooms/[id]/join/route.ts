import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/lib/rooms";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ax_room_session";

/** 방 입장 (세션 등록) — 같은 브라우저는 한 번만 카운트 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params?.id;
  if (!roomId) {
    return NextResponse.json({ error: "room id required" }, { status: 400 });
  }
  try {
    const cookieStore = cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }
    const result = await joinRoom(roomId, sessionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "입장 실패" },
        { status: 400 }
      );
    }
    const res = NextResponse.json({ ok: true });
    if (isNewSession) {
      res.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return res;
  } catch (e) {
    console.error("POST /api/rooms/[id]/join", e);
    return NextResponse.json(
      { error: "입장 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
