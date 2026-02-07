import { NextRequest, NextResponse } from "next/server";
import { leaveRoom } from "@/lib/rooms";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ax_room_session";

/** 방 퇴장 (세션 제거). PartyKit onClose 시 body.sessionId + x-internal-secret 로 호출 가능 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params?.id;
  if (!roomId) {
    return NextResponse.json({ error: "room id required" }, { status: 400 });
  }
  try {
    const cookieStore = cookies();
    let sessionId: string | undefined = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      const body = await request.json().catch(() => ({}));
      sessionId = typeof body?.sessionId === "string" ? body.sessionId : undefined;
    }
    if (sessionId) {
      await leaveRoom(roomId, sessionId);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/rooms/[id]/leave", e);
    return NextResponse.json(
      { error: "퇴장 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
