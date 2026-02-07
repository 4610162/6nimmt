/**
 * 6 nimmt! (Take 6!) - Game Data Types
 * PartyKit 실시간 멀티플레이용 타입 정의
 */

/** 카드 (1-104번, 각 카드별 황소 머리 수) */
export interface Card {
  id: number; // 1-104
  bullHeads: number; // 1-7 (패널티 포인트)
}

/** 플레이어 상태 */
export interface Player {
  id: string;
  name: string;
  hand: Card[];
  collectedCards: Card[]; // 수집한 카드 (패널티)
  score: number; // 누적 패널티 점수
  isReady?: boolean;
  connected?: boolean;
  /** 봇 여부 — true면 서버에서 카드/행 선택 자동 수행 */
  isBot?: boolean;
}

/** 테이블의 한 행 (최대 5장) */
export type TableRow = Card[];

/** 게임 단계 */
export type GamePhase =
  | "waiting" // 대기실 (플레이어 입장 대기)
  | "selecting" // 카드 선택 중
  | "revealing" // 카드 공개 및 배치
  | "resolving" // 행 처리 (6번째 카드 시 수집 등)
  | "roundEnd" // 라운드 종료
  | "gameEnd"; // 게임 종료 (누군가 66점 도달)

/** 라운드 내 턴 정보 */
export interface TurnInfo {
  phase: GamePhase;
  turnNumber: number; // 1-10 (라운드당 10턴)
  playedCards: Record<string, Card>; // playerId -> 선택한 카드 (selecting 시 클라이언트에는 비공개)
  committedCount?: number; // selecting 시 커밋한 플레이어 수 (브로드캐스트용)
  committedPlayerIds?: string[]; // selecting 시 카드 선택 완료한 플레이어 ID 목록
  lowestCardPlayer?: string; // 가장 낮은 카드를 낸 플레이어 (행 선택 권한)
  waitingForRowChoice?: string; // chooseRow 대기 중인 플레이어 ID
}

/** 카드 배치 순서 (애니메이션용) */
export interface PlacementStep {
  card: Card;
  rowIndex: number;
  cardIndexInRow: number;
}

/** 게임 상태 */
export interface GameState {
  phase: GamePhase;
  players: Player[];
  tableRows: TableRow[]; // 4개 행
  currentRound: number;
  turnInfo: TurnInfo;
  winner?: string; // gameEnd 시 승자 (가장 낮은 점수)
  placementOrder?: PlacementStep[]; // 카드 배치 순서 (애니메이션용, resolve 후 1회만 전송)
  /** 방장(호스트) 플레이어 ID — 게임 시작 버튼 권한 */
  hostId?: string;
  /** 플레이어 ID → Redis 세션 ID (onClose 시 leaveRoom 호출용) */
  playerSessionIds?: Record<string, string>;
}

/** 클라이언트 -> 서버 메시지 타입 */
export type ClientMessage =
  | { type: "join"; name: string; sessionId?: string }
  | { type: "setSessionId"; sessionId: string }
  | { type: "ready" }
  | { type: "unready" }
  | { type: "addBot" }
  | { type: "playCard"; cardId: number }
  | { type: "chooseRow"; rowIndex: number } // 카드가 모든 행보다 낮을 때
  | { type: "startGame" };

/** 서버 -> 클라이언트 메시지 타입 */
export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "stateWithConnectionId"; state: GameState; yourConnectionId: string }
  | { type: "botAdded"; state: GameState }
  | { type: "yourConnectionId"; id: string }
  | { type: "error"; message: string };

/** 황소 머리 수 계산 (6 nimmt! 규칙) */
export function getBullHeads(cardId: number): number {
  if (cardId === 55) return 7;
  if (cardId % 11 === 0) return 5;
  if (cardId % 10 === 0) return 3;
  if (cardId % 5 === 0) return 2;
  return 1;
}

/** 전체 덱 생성 (1-104) */
export function createDeck(): Card[] {
  return Array.from({ length: 104 }, (_, i) => ({
    id: i + 1,
    bullHeads: getBullHeads(i + 1),
  }));
}
