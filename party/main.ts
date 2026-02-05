/**
 * 6 nimmt! (Take 6!) - PartyKit Game Server
 * GameState 중앙 관리, 카드 동시 공개, 결과 브로드캐스트
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
const CARDS_PER_PLAYER = 10;
const TABLE_ROWS = 4;
const GAME_OVER_SCORE = 66;

type ClientMessage =
  | { type: "join"; name: string }
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
        await this.handleJoin(state, sender, msg.name);
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
    if (!player) return;

    player.connected = false;
    await this.room.storage.put("gameState", state);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(state) })
    );

    if (state.phase === "selecting" && !state.turnInfo.playedCards[playerId] && player.hand.length > 0) {
      const lowestCard = player.hand.reduce((min, c) => (c.id < min.id ? c : min));
      state.turnInfo.playedCards[playerId] = lowestCard;
      const committedCount = Object.keys(state.turnInfo.playedCards).length;
      const totalPlayers = state.players.length;
      if (committedCount < totalPlayers) {
        state.turnInfo.committedCount = committedCount;
        await this.room.storage.put("gameState", state);
        this.room.broadcast(
          JSON.stringify({ type: "state", state: getBroadcastState(state) })
        );
        return;
      }
      await this.revealAndResolve(state);
      return;
    }

    if (state.phase === "resolving" && state.turnInfo.waitingForRowChoice === playerId) {
      await this.resolveWithRowChoice(state, 0);
    }
  }

  private async handleJoin(
    state: GameState,
    sender: Party.Connection,
    name: string
  ) {
    if (state.phase !== "waiting") {
      sender.send(
        JSON.stringify({ type: "error", message: "게임이 이미 시작되었습니다." })
      );
      return;
    }

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
      state.players.push({
        id: sender.id,
        name,
        hand: [],
        collectedCards: [],
        score: 0,
        connected: true,
      });
    }

    await this.room.storage.put("gameState", state);
    this.room.broadcast(
      JSON.stringify({
        type: "state",
        state: getBroadcastState(state),
      })
    );
  }

  private async handleStartGame(state: GameState, sender: Party.Connection) {
    if (state.phase !== "waiting") {
      sender.send(
        JSON.stringify({ type: "error", message: "이미 게임이 진행 중입니다." })
      );
      return;
    }

    const playerCount = state.players.filter((p) => p.connected).length;
    if (playerCount < MIN_PLAYERS) {
      sender.send(
        JSON.stringify({
          type: "error",
          message: `최소 ${MIN_PLAYERS}명이 필요합니다.`,
        })
      );
      return;
    }

    const activePlayers = state.players.filter((p) => p.connected);
    const newState = initializeGame(activePlayers);
    await this.room.storage.put("gameState", newState);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: getBroadcastState(newState) })
    );
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

    if (state.turnInfo.playedCards[sender.id]) {
      sender.send(
        JSON.stringify({ type: "error", message: "이미 카드를 선택했습니다." })
      );
      return;
    }

    const card = player.hand[cardIndex];
    state.turnInfo.playedCards[sender.id] = card;

    const committedCount = Object.keys(state.turnInfo.playedCards).length;
    const totalPlayers = state.players.length;

    if (committedCount < totalPlayers) {
      state.turnInfo.committedCount = committedCount;
      await this.room.storage.put("gameState", state);
      this.room.broadcast(
        JSON.stringify({ type: "state", state: getBroadcastState(state) })
      );
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
      return;
    }

    await this.doResolveTurn(state);
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
  }
}
