/**
 * 6 nimmt! (Take 6!) - PartyKit Game Server
 * GameState 중앙 관리, 카드 동시 공개, 봇/준비/이탈→봇 대체
 */

import type * as Party from "partykit/server";
import type { GameState, Player, TableRow } from "../types/game";
import {
  createDeck,
  findRowForCard,
  getTotalBullHeads,
  resolveTurn,
} from "../lib/game";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const MAX_BOTS = 9;
const CARDS_PER_PLAYER = 10;
const TABLE_ROWS = 4;
const GAME_OVER_SCORE = 66;
const BOT_DELAY_MIN_MS = 500;
const BOT_DELAY_MAX_MS = 1500;

type ClientMessage =
  | { type: "join"; name: string; sessionId?: string }
  | { type: "setSessionId"; sessionId: string }
  | { type: "ready" }
  | { type: "unready" }
  | { type: "addBot" }
  | { type: "playCard"; cardId: number }
  | { type: "chooseRow"; rowIndex: number }
  | { type: "startGame" };

function createInitialState(): GameState {
  return {
    phase: "waiting",
    players: [],
    tableRows: [],
    currentRound: 0,
    turnInfo: {
      phase: "waiting",
      turnNumber: 0,
      playedCards: {},
    },
    hostId: undefined,
    playerSessionIds: {},
  };
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function initializeGame(players: Player[]): GameState {
  const deck = shuffle(createDeck());
  const playerCount = players.length;
  const cardsNeeded = playerCount * CARDS_PER_PLAYER + TABLE_ROWS;
  const usedCards = deck.slice(0, cardsNeeded);
  const tableCards = usedCards.slice(0, TABLE_ROWS);
  const handCards = usedCards.slice(TABLE_ROWS);

  const tableRows: TableRow[] = tableCards.map((card) => [card]);
  const playersWithHands: Player[] = players.map((player, i) => ({
    ...player,
    hand: handCards.slice(
      i * CARDS_PER_PLAYER,
      (i + 1) * CARDS_PER_PLAYER
    ),
    collectedCards: [],
    score: 0,
  }));

  return {
    phase: "selecting",
    players: playersWithHands,
    tableRows,
    currentRound: 1,
    turnInfo: {
      phase: "selecting",
      turnNumber: 1,
      playedCards: {},
    },
  };
}

/** selecting 단계에서 브로드캐스트할 상태 (카드 값 비공개) */
function getBroadcastState(state: GameState): GameState {
  const broadcast = JSON.parse(JSON.stringify(state)) as GameState;

  if (state.phase === "selecting") {
    broadcast.turnInfo.committedCount = Object.keys(
      state.turnInfo.playedCards
    ).length;
    broadcast.turnInfo.committedPlayerIds = Object.keys(
      state.turnInfo.playedCards
    );
    broadcast.turnInfo.playedCards = {};
  }

  return broadcast;
}

/** 특정 플레이어만 자신이 선택한 카드를 보이도록 한 상태 (선택 변경/취소 UI용) */
function getBroadcastStateForPlayer(state: GameState, playerId: string): GameState {
  const personal = getBroadcastState(state);
  if (state.phase === "selecting" && state.turnInfo.playedCards[playerId]) {
    personal.turnInfo.playedCards = {
      [playerId]: state.turnInfo.playedCards[playerId],
    };
  }
  return personal;
}

export default class GameServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onStart() {
    const stored = await this.room.storage.get<GameState>("gameState");
    if (!stored) {
      await this.room.storage.put("gameState", createInitialState());
    }
  }

  async onConnect(connection: Party.Connection) {
    const state = (await this.room.storage.get<GameState>("gameState")) ?? createInitialState();
    connection.send(
      JSON.stringify({ type: "state", state: getBroadcastState(state) })
    );
    connection.send(
      JSON.stringify({ type: "yourConnectionId", id: connection.id })
    );
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message as string) as ClientMessage;
    } catch {
      sender.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }

    const state =
      (await this.room.storage.get<GameState>("gameState")) ?? createInitialState();

    switch (msg.type) {
      case "join":
        await this.handleJoin(state, sender, msg.name, msg.sessionId);
        break;
      case "setSessionId":
        if (typeof msg.sessionId === "string") {
          if (!state.playerSessionIds) state.playerSessionIds = {};
          state.playerSessionIds[sender.id] = msg.sessionId;
          await this.room.storage.put("gameState", state);
        }
        break;
      case "ready":
        await this.handleReady(state, sender, true);
        break;
      case "unready":
        await this.handleReady(state, sender, false);
        break;
      case "addBot":
        await this.handleAddBot(state, sender);
        break;
      case "startGame":
        await this.handleStartGame(state, sender);
        break;
      case "playCard":
        await this.handlePlayCard(state, sender, msg.cardId);
        break;
      case "chooseRow":
        await this.handleChooseRow(state, sender, msg.rowIndex);
        break;
    }
  }

  async onClose(connection: Party.Connection) {
    const state = (await this.room.storage.get<GameState>("gameState")) ?? createInitialState();
    const playerId = connection.id;
    const player = state.players.find((p) => p.id === playerId);
    const sessionId = state.playerSessionIds?.[playerId];

    if (state.phase === "waiting") {
      // 시작 전 이탈: 봇으로 대체하지 않고 목록에서 제거, Redis leave 호출
      if (sessionId) {
        await this.callLeaveRoom(this.room.id, sessionId);
      }
      if (player) {
        state.players = state.players.filter((p) => p.id !== playerId);
        delete state.playerSessionIds?.[playerId];
        if (state.hostId === playerId) {
          state.hostId = state.players.length > 0 ? state.players[0].id : undefined;
        }
        await this.room.storage.put("gameState", state);
        this.broadcastStateWaiting(state);
      }
      return;
    }

    if (!player) return;

    // 게임 중 이탈: 봇으로 전환
    (player as Player).isBot = true;
    player.connected = false;
    if (sessionId) {
      await this.callLeaveRoom(this.room.id, sessionId);
    }

    await this.room.storage.put("gameState", state);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(state) })
    );

    if (state.phase === "selecting" && !state.turnInfo.playedCards[playerId] && player.hand.length > 0) {
      const botCard = player.hand[Math.floor(Math.random() * player.hand.length)];
      state.turnInfo.playedCards[playerId] = botCard;
      const committedCount = Object.keys(state.turnInfo.playedCards).length;
      const totalPlayers = state.players.length;
      if (committedCount < totalPlayers) {
        state.turnInfo.committedCount = committedCount;
        await this.room.storage.put("gameState", state);
        this.broadcastStateInSelecting(state);
        return;
      }
      await this.revealAndResolve(state);
      return;
    }

    if (state.phase === "resolving" && state.turnInfo.waitingForRowChoice === playerId) {
      await this.resolveWithRowChoice(state, 0);
    }
  }

  /** waiting 단계: 각 연결마다 state + yourConnectionId를 한 메시지로 전송 (클라이언트가 항상 올바른 connectionId 수신) */
  private broadcastStateWaiting(state: GameState, sender?: Party.Connection): void {
    const broadcastState = getBroadcastState(state);
    const payload = (connId: string) =>
      JSON.stringify({
        type: "stateWithConnectionId",
        state: broadcastState,
        yourConnectionId: connId,
      });
    if (sender?.id) {
      sender.send(payload(sender.id));
    }
    const connections = Array.from(this.room.getConnections());
    const senderId = sender?.id ?? "";
    for (const conn of connections) {
      if (conn.id && conn.id !== senderId) {
        conn.send(payload(conn.id));
      }
    }
  }

  /** selecting 단계에서 브로드캐스트 + 각 연결에 본인 선택 카드만 포함한 state 전송 */
  private broadcastStateInSelecting(state: GameState): void {
    const baseState = getBroadcastState(state);
    this.room.broadcast(JSON.stringify({ type: "state", state: baseState }));
    if (state.phase !== "selecting") return;
    const connections = Array.from(this.room.getConnections());
    for (const conn of connections) {
      const pid = conn.id;
      if (pid && state.turnInfo.playedCards[pid]) {
        conn.send(
          JSON.stringify({
            type: "state",
            state: getBroadcastStateForPlayer(state, pid),
          })
        );
      }
    }
  }

  /** Next.js API를 통해 Redis leaveRoom 호출 (onClose 시 세션 제거) */
  private async callLeaveRoom(roomId: string, sessionId: string): Promise<void> {
    const base = process.env.PARTYKIT_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const secret = process.env.INTERNAL_LEAVE_SECRET;
    try {
      await fetch(`${base}/api/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-internal-secret": secret } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (e) {
      console.error("callLeaveRoom failed", e);
    }
  }

  private async handleJoin(
    state: GameState,
    sender: Party.Connection,
    name: string,
    sessionId?: string
  ) {
    if (state.phase !== "waiting") {
      sender.send(
        JSON.stringify({ type: "error", message: "게임이 이미 시작되었습니다." })
      );
      return;
    }

    if (!state.playerSessionIds) state.playerSessionIds = {};
    if (sessionId) state.playerSessionIds[sender.id] = sessionId;

    const existing = state.players.find((p) => p.id === sender.id);
    if (existing) {
      existing.name = name;
      existing.connected = true;
    } else {
      if (state.players.length >= MAX_PLAYERS) {
        sender.send(
          JSON.stringify({ type: "error", message: "방이 가득 찼습니다." })
        );
        return;
      }
      const isFirst = state.players.length === 0;
      state.players.push({
        id: sender.id,
        name,
        hand: [],
        collectedCards: [],
        score: 0,
        connected: true,
        isBot: false,
        isReady: isFirst, // 방장은 기본 준비
      });
      if (isFirst) state.hostId = sender.id;
    }

    await this.room.storage.put("gameState", state);
    this.broadcastStateWaiting(state);
  }

  private async handleReady(
    state: GameState,
    sender: Party.Connection,
    ready: boolean
  ) {
    if (state.phase !== "waiting") return;
    const player = state.players.find((p) => p.id === sender.id);
    if (!player || player.isBot) return;
    player.isReady = ready;
    await this.room.storage.put("gameState", state);
    this.broadcastStateWaiting(state);
  }

  private async handleAddBot(state: GameState, sender: Party.Connection) {
    if (state.phase !== "waiting") {
      sender.send(
        JSON.stringify({ type: "error", message: "게임이 이미 시작되었습니다." })
      );
      return;
    }
    const players = Array.isArray(state.players) ? state.players : [];
    const botCount = players.filter((p) => p.isBot).length;
    if (botCount >= MAX_BOTS) {
      sender.send(
        JSON.stringify({ type: "error", message: `봇은 최대 ${MAX_BOTS}명까지 추가할 수 있습니다.` })
      );
      return;
    }
    if (players.length >= MAX_PLAYERS) {
      sender.send(
        JSON.stringify({ type: "error", message: "방이 가득 찼습니다." })
      );
      return;
    }
    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newBot: Player = {
      id: botId,
      name: `봇 ${botCount + 1}`,
      hand: [],
      collectedCards: [],
      score: 0,
      connected: true,
      isBot: true,
      isReady: true,
    };
    const newState: GameState = {
      ...state,
      players: [...players, newBot],
    };
    try {
      await this.room.storage.put("gameState", newState);
    } catch (e) {
      console.error("handleAddBot storage.put", e);
      sender.send(JSON.stringify({ type: "error", message: "상태 저장 실패" }));
      return;
    }
    let broadcastState: GameState;
    try {
      broadcastState = getBroadcastState(newState);
    } catch (e) {
      console.error("handleAddBot getBroadcastState", e);
      sender.send(JSON.stringify({ type: "error", message: "상태 생성 실패" }));
      return;
    }
    const stateMsg = JSON.stringify({ type: "state", state: broadcastState });
    sender.send(JSON.stringify({ type: "botAdded", state: broadcastState }));
    this.room.broadcast(stateMsg);
    this.broadcastStateWaiting(newState, sender);
  }

  private async handleStartGame(state: GameState, sender: Party.Connection) {
    if (state.phase !== "waiting") {
      sender.send(
        JSON.stringify({ type: "error", message: "이미 게임이 진행 중입니다." })
      );
      return;
    }
    if (state.hostId !== sender.id) {
      sender.send(
        JSON.stringify({ type: "error", message: "방장만 게임을 시작할 수 있습니다." })
      );
      return;
    }
    const humanPlayers = state.players.filter((p) => !p.isBot);
    const allHumansReady = humanPlayers.every(
      (p) => p.id === state.hostId || p.isReady === true
    );
    if (!allHumansReady) {
      sender.send(
        JSON.stringify({
          type: "error",
          message: "모든 플레이어가 준비할 때까지 시작할 수 없습니다.",
        })
      );
      return;
    }
    if (state.players.length < MIN_PLAYERS) {
      sender.send(
        JSON.stringify({
          type: "error",
          message: `최소 ${MIN_PLAYERS}명이 필요합니다.`,
        })
      );
      return;
    }

    const newState = initializeGame(state.players);
    newState.hostId = state.hostId;
    newState.playerSessionIds = state.playerSessionIds;
    await this.room.storage.put("gameState", newState);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(newState) })
    );
    this.scheduleBotMoves();
  }

  private async handlePlayCard(
    state: GameState,
    sender: Party.Connection,
    cardId: number
  ) {
    if (state.phase !== "selecting") {
      sender.send(
        JSON.stringify({ type: "error", message: "카드 선택 단계가 아닙니다." })
      );
      return;
    }

    const player = state.players.find((p) => p.id === sender.id);
    if (!player) {
      sender.send(JSON.stringify({ type: "error", message: "플레이어가 없습니다." }));
      return;
    }

    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      sender.send(
        JSON.stringify({ type: "error", message: "손패에 없는 카드입니다." })
      );
      return;
    }

    const current = state.turnInfo.playedCards[sender.id];
    if (current?.id === cardId) {
      // 같은 카드 클릭 → 선택 취소 (변경 허용)
      delete state.turnInfo.playedCards[sender.id];
    } else {
      const card = player.hand[cardIndex];
      state.turnInfo.playedCards[sender.id] = card;
    }

    const committedCount = Object.keys(state.turnInfo.playedCards).length;
    const totalPlayers = state.players.length;

    if (committedCount < totalPlayers) {
      state.turnInfo.committedCount = committedCount;
      await this.room.storage.put("gameState", state);
      this.broadcastStateInSelecting(state);
      return;
    }

    await this.revealAndResolve(state);
  }

  private async handleChooseRow(
    state: GameState,
    sender: Party.Connection,
    rowIndex: number
  ) {
    if (state.phase !== "resolving") {
      sender.send(
        JSON.stringify({ type: "error", message: "행 선택 단계가 아닙니다." })
      );
      return;
    }

    if (state.turnInfo.waitingForRowChoice !== sender.id) {
      sender.send(
        JSON.stringify({ type: "error", message: "행 선택 권한이 없습니다." })
      );
      return;
    }

    if (rowIndex < 0 || rowIndex > 3) {
      sender.send(
        JSON.stringify({ type: "error", message: "유효한 행(0~3)을 선택하세요." })
      );
      return;
    }

    await this.resolveWithRowChoice(state, rowIndex);
  }

  /** 모든 플레이어 선택 완료 → 카드 공개 및 결과 계산 */
  private async revealAndResolve(state: GameState) {
    state.phase = "revealing";
    state.turnInfo.phase = "revealing";
    delete state.turnInfo.committedCount;
    await this.room.storage.put("gameState", state);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(state) })
    );

    const playedCards = state.turnInfo.playedCards;
    const sortedEntries = Object.entries(playedCards).sort(
      ([, a], [, b]) => a.id - b.id
    );
    const lowestPlayerId = sortedEntries[0]?.[0];
    const lowestCard = sortedEntries[0]?.[1];

    if (!lowestCard || !lowestPlayerId) {
      await this.advanceTurn(state);
      return;
    }

    const needsRowChoice = findRowForCard(lowestCard, state.tableRows).type === "takeRow";

    if (needsRowChoice) {
      state.phase = "resolving";
      state.turnInfo.phase = "resolving";
      state.turnInfo.waitingForRowChoice = lowestPlayerId;
      state.turnInfo.lowestCardPlayer = lowestPlayerId;
      await this.room.storage.put("gameState", state);
      this.room.broadcast(
        JSON.stringify({ type: "state", state: getBroadcastState(state) })
      );
      const player = state.players.find((p) => p.id === lowestPlayerId);
      if (player?.isBot) {
        this.scheduleBotRowChoice(lowestPlayerId);
      }
      return;
    }

    await this.doResolveTurn(state);
  }

  /** resolving 단계에서 행 선택 대기 중인 봇이 0.5~1.5초 후 행 선택 (벌점 최소화) */
  private scheduleBotRowChoice(botPlayerId: string): void {
    const room = this.room;
    const delay = BOT_DELAY_MIN_MS + Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS);
    setTimeout(async () => {
      const state = (await room.storage.get<GameState>("gameState")) ?? createInitialState();
      if (state.phase !== "resolving" || state.turnInfo.waitingForRowChoice !== botPlayerId) {
        return;
      }
      const player = state.players.find((p) => p.id === botPlayerId);
      if (!player?.isBot) return;

      const tableRows = state.tableRows;
      let bestRow = 0;
      let bestPenalty = getTotalBullHeads(tableRows[0] ?? []);
      for (let i = 1; i < tableRows.length; i++) {
        const penalty = getTotalBullHeads(tableRows[i] ?? []);
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestRow = i;
        }
      }
      await this.runBotChooseRow(bestRow);
    }, delay);
  }

  private async runBotChooseRow(rowIndex: number): Promise<void> {
    const state = (await this.room.storage.get<GameState>("gameState")) ?? createInitialState();
    if (state.phase !== "resolving") return;
    const waitingId = state.turnInfo.waitingForRowChoice;
    if (!waitingId) return;
    const player = state.players.find((p) => p.id === waitingId);
    if (!player?.isBot) return;
    if (rowIndex < 0 || rowIndex > 3) return;

    await this.resolveWithRowChoice(state, rowIndex);
  }

  private async resolveWithRowChoice(state: GameState, rowIndex: number) {
    delete state.turnInfo.waitingForRowChoice;
    await this.doResolveTurn(state, rowIndex);
  }

  private async doResolveTurn(
    state: GameState,
    lowestCardRowChoice?: number
  ) {
    const { tableRows, collections, placementOrder } = resolveTurn(
      state.tableRows,
      state.turnInfo.playedCards,
      lowestCardRowChoice
    );

    state.tableRows = tableRows;
    state.placementOrder = placementOrder;

    for (const { playerId, cards } of collections) {
      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.collectedCards.push(...cards);
        const penalty = getTotalBullHeads(cards);
        player.score += penalty;
      }
    }

    for (const player of state.players) {
      const playedCard = state.turnInfo.playedCards[player.id];
      if (playedCard) {
        player.hand = player.hand.filter((c) => c.id !== playedCard.id);
      }
    }

    const gameOverPlayer = state.players.find((p) => p.score >= GAME_OVER_SCORE);
    if (gameOverPlayer) {
      const winner = state.players.reduce((a, b) =>
        a.score < b.score ? a : b
      );
      state.phase = "gameEnd";
      state.turnInfo.phase = "gameEnd";
      state.winner = winner.id;
      await this.room.storage.put("gameState", state);
      this.room.broadcast(
        JSON.stringify({ type: "state", state: getBroadcastState(state) })
      );
      return;
    }

    await this.advanceTurn(state);
  }

  private async advanceTurn(state: GameState) {
    delete state.placementOrder;
    const turnNumber = state.turnInfo.turnNumber;

    if (turnNumber >= 10) {
      state.phase = "roundEnd";
      state.turnInfo.phase = "roundEnd";
      await this.room.storage.put("gameState", state);
      this.room.broadcast(
        JSON.stringify({ type: "state", state: getBroadcastState(state) })
      );

      for (const player of state.players) {
        player.collectedCards = [];
      }
      state.currentRound += 1;
      state.turnInfo.turnNumber = 1;
      state.turnInfo.playedCards = {};
      delete state.turnInfo.lowestCardPlayer;
      delete state.turnInfo.waitingForRowChoice;

      const deck = shuffle(createDeck());
      const playerCount = state.players.length;
      const cardsNeeded = playerCount * CARDS_PER_PLAYER + TABLE_ROWS;
      const usedCards = deck.slice(0, cardsNeeded);
      const tableCards = usedCards.slice(0, TABLE_ROWS);
      const handCards = usedCards.slice(TABLE_ROWS);

      state.tableRows = tableCards.map((card) => [card]);
      state.players.forEach((player, i) => {
        player.hand = handCards.slice(
          i * CARDS_PER_PLAYER,
          (i + 1) * CARDS_PER_PLAYER
        );
      });

      state.phase = "selecting";
      state.turnInfo.phase = "selecting";
    } else {
      state.phase = "selecting";
      state.turnInfo.phase = "selecting";
      state.turnInfo.turnNumber = turnNumber + 1;
      state.turnInfo.playedCards = {};
      delete state.turnInfo.lowestCardPlayer;
      delete state.turnInfo.waitingForRowChoice;
    }

    await this.room.storage.put("gameState", state);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(state) })
    );
    this.scheduleBotMoves();
  }

  /** selecting 단계에서 아직 카드를 내지 않은 봇들에게 0.5~1.5초 지연 후 랜덤 카드 제출 스케줄 */
  private scheduleBotMoves(): void {
    const room = this.room;
    setTimeout(async () => {
      const state = (await room.storage.get<GameState>("gameState")) ?? createInitialState();
      if (state.phase !== "selecting") return;

      const botsToMove = state.players.filter(
        (p) => p.isBot && p.hand.length > 0 && !state.turnInfo.playedCards[p.id]
      );
      for (const bot of botsToMove) {
        const delay = BOT_DELAY_MIN_MS + Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS);
        setTimeout(() => this.runBotPlayCard(bot.id), delay);
      }
    }, 100);
  }

  private async runBotPlayCard(playerId: string): Promise<void> {
    const state = (await this.room.storage.get<GameState>("gameState")) ?? createInitialState();
    if (state.phase !== "selecting") return;
    const player = state.players.find((p) => p.id === playerId);
    if (!player?.isBot || !player.hand.length || state.turnInfo.playedCards[playerId]) return;

    const card = player.hand[Math.floor(Math.random() * player.hand.length)];
    state.turnInfo.playedCards[playerId] = card;

    const committedCount = Object.keys(state.turnInfo.playedCards).length;
    const totalPlayers = state.players.length;

    if (committedCount < totalPlayers) {
      state.turnInfo.committedCount = committedCount;
      await this.room.storage.put("gameState", state);
      this.broadcastStateInSelecting(state);
      return;
    }
    await this.revealAndResolve(state);
  }
}
