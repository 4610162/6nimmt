import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ax_room_session";

/** 클라이언트가 PartyKit join 시 sessionId를 전달할 수 있도록 세션 ID 조회 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    return NextResponse.json({ sessionId });
  } catch (e) {
    console.error("GET /api/session", e);
    return NextResponse.json({ sessionId: null }, { status: 500 });
  }
}
