import { NextRequest, NextResponse } from "next/server";
import { getRooms, createRoom } from "@/lib/rooms";

/** 현재 활성화된 방 목록 조회 */
export async function GET() {
  try {
    const rooms = await getRooms();
    return NextResponse.json(rooms);
  } catch (e) {
    console.error("GET /api/rooms", e);
    return NextResponse.json(
      { error: "방 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

/** 새 방 생성 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : undefined;
    const meta = await createRoom(title);
    return NextResponse.json(meta);
  } catch (e) {
    console.error("POST /api/rooms", e);
    return NextResponse.json(
      { error: "방을 만들 수 없습니다." },
      { status: 500 }
    );
  }
}
