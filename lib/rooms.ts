/**
 * 공개 대기실 — 방 목록 저장소
 * Upstash Redis 사용 (환경 변수 미설정 시 로컬 메모리 fallback)
 */

const ROOM_LIST_KEY = "ax:rooms:list";
const ROOM_META_PREFIX = "ax:room:";
const ROOM_MEMBERS_PREFIX = "ax:room:members:";
const MAX_PLAYERS = 10;
/** 1분 동안 활동 없으면 방 만료 */
const ROOM_TTL_SECONDS = 60;

export interface RoomMeta {
  roomId: string;
  title: string;
  createdAt: number;
  maxPlayers: number;
}

export interface RoomWithCount extends RoomMeta {
  currentPlayers: number;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const { Redis } = require("@upstash/redis");
    return new Redis({ url, token });
  }
  return null;
}

// 로컬 개발용 메모리 저장소 (Redis 미설정 시)
const memoryStore: {
  roomIds: Set<string>;
  meta: Map<string, RoomMeta>;
  members: Map<string, Set<string>>;
} = {
  roomIds: new Set(),
  meta: new Map(),
  members: new Map(),
};

function generateRoomId(): string {
  return "room-" + (1000 + Math.floor(Math.random() * 9000));
}

/** 방 목록 조회 — Redis에 현재 존재하는(만료되지 않은) 방만 반환 */
export async function getRooms(): Promise<RoomWithCount[]> {
  const redis = getRedis();
  if (redis) {
    const roomIds = (await redis.smembers(ROOM_LIST_KEY)) as string[];
    if (!roomIds?.length) return [];
    const rooms: RoomWithCount[] = [];
    for (const roomId of roomIds) {
      const metaKey = ROOM_META_PREFIX + roomId;
      const exists = await redis.exists(metaKey);
      if (!exists) {
        await redis.srem(ROOM_LIST_KEY, roomId);
        continue;
      }
      const meta = (await redis.hgetall(metaKey)) as Record<string, string> | null;
      if (!meta) continue;
      const count = await redis.scard(ROOM_MEMBERS_PREFIX + roomId);
      rooms.push({
        roomId,
        title: meta.title ?? "무제",
        createdAt: Number(meta.createdAt) || 0,
        maxPlayers: Number(meta.maxPlayers) || MAX_PLAYERS,
        currentPlayers: count ?? 0,
      });
    }
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    return rooms;
  }
  const rooms: RoomWithCount[] = [];
  for (const roomId of Array.from(memoryStore.roomIds)) {
    const meta = memoryStore.meta.get(roomId);
    if (!meta) continue;
    const members = memoryStore.members.get(roomId);
    rooms.push({
      ...meta,
      currentPlayers: members?.size ?? 0,
    });
  }
  rooms.sort((a, b) => b.createdAt - a.createdAt);
  return rooms;
}

/** 방 생성 */
export async function createRoom(title?: string): Promise<RoomMeta> {
  const redis = getRedis();
  const roomId = generateRoomId();
  const meta: RoomMeta = {
    roomId,
    title: title?.trim() || "무제",
    createdAt: Date.now(),
    maxPlayers: MAX_PLAYERS,
  };
  if (redis) {
    const metaKey = ROOM_META_PREFIX + roomId;
    const membersKey = ROOM_MEMBERS_PREFIX + roomId;
    await redis.sadd(ROOM_LIST_KEY, roomId);
    await redis.hset(metaKey, {
      roomId,
      title: meta.title,
      createdAt: String(meta.createdAt),
      maxPlayers: String(meta.maxPlayers),
    });
    await redis.expire(metaKey, ROOM_TTL_SECONDS);
    return meta;
  }
  memoryStore.roomIds.add(roomId);
  memoryStore.meta.set(roomId, meta);
  memoryStore.members.set(roomId, new Set());
  return meta;
}

/** 방 입장 (세션 추가) */
export async function joinRoom(roomId: string, sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const redis = getRedis();
  if (redis) {
    const metaKey = ROOM_META_PREFIX + roomId;
    const membersKey = ROOM_MEMBERS_PREFIX + roomId;
    const exists = await redis.exists(metaKey);
    if (!exists) return { ok: false, error: "방이 없습니다." };
    const meta = (await redis.hgetall(metaKey)) as Record<string, string> | null;
    const max = meta ? Number(meta.maxPlayers) || MAX_PLAYERS : MAX_PLAYERS;
    const count = await redis.scard(membersKey);
    if (count >= max) return { ok: false, error: "방이 가득 찼습니다." };
    await redis.sadd(membersKey, sessionId);
    await redis.expire(metaKey, ROOM_TTL_SECONDS);
    await redis.expire(membersKey, ROOM_TTL_SECONDS);
    return { ok: true };
  }
  const meta = memoryStore.meta.get(roomId);
  if (!meta) return { ok: false, error: "방이 없습니다." };
  let members = memoryStore.members.get(roomId);
  if (!members) {
    members = new Set();
    memoryStore.members.set(roomId, members);
  }
  if (members.size >= meta.maxPlayers) return { ok: false, error: "방이 가득 찼습니다." };
  members.add(sessionId);
  return { ok: true };
}

/** 방 퇴장 (세션 제거). 모든 플레이어가 나가면 방 키 삭제 */
export async function leaveRoom(roomId: string, sessionId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const metaKey = ROOM_META_PREFIX + roomId;
    const membersKey = ROOM_MEMBERS_PREFIX + roomId;
    await redis.srem(membersKey, sessionId);
    const count = await redis.scard(membersKey);
    if (count === 0) {
      await redis.del(metaKey);
      await redis.del(membersKey);
      await redis.srem(ROOM_LIST_KEY, roomId);
    }
    return;
  }
  const members = memoryStore.members.get(roomId);
  if (members) {
    members.delete(sessionId);
    if (members.size === 0) {
      memoryStore.members.delete(roomId);
      memoryStore.meta.delete(roomId);
      memoryStore.roomIds.delete(roomId);
    }
  }
}
