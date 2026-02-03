/**
 * 6 nimmt! (Take 6!) - Game Logic
 * 카드 생성, 벌점 계산, 행 배치, 6번째 카드 벌점 처리
 */

import type { Card, PlacementStep, TableRow } from "../types/game";

// Re-export for convenience
export { getBullHeads, createDeck } from "../types/game";

// ============ 1. 벌점(황소 머리) 유틸 ============

/**
 * 카드 배열의 총 벌점(황소 머리) 합계
 */
export function getTotalBullHeads(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.bullHeads, 0);
}

// ============ 2. 최소 차이 오름차순 - 행 배치 로직 ============

/** 행에 배치 가능한 결과 */
export type RowPlacementResult =
  | { type: "place"; rowIndex: number } // 해당 행에 배치
  | { type: "takeRow"; rowIndex?: number }; // 모든 행보다 낮음 → 플레이어가 행 선택 필요

/**
 * 카드를 배치할 행 인덱스를 결정 (최소 차이 오름차순)
 *
 * 규칙: 새 카드는 '마지막 카드보다 크면서' '차이가 가장 작은' 행에 배치
 * - 모든 행의 마지막 카드보다 낮으면 → takeRow (플레이어가 어느 행을 가져갈지 선택)
 *
 * @param card 배치할 카드
 * @param tableRows 4개 행 (각 행은 오름차순)
 * @returns 배치할 행 인덱스 또는 takeRow
 */
export function findRowForCard(
  card: Card,
  tableRows: TableRow[]
): RowPlacementResult {
  const cardValue = card.id;
  let bestRowIndex = -1;
  let smallestDiff = Infinity;

  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];
    if (row.length === 0) continue;

    const lastCard = row[row.length - 1];
    const lastValue = lastCard.id;

    // 새 카드가 마지막 카드보다 커야 배치 가능
    if (cardValue > lastValue) {
      const diff = cardValue - lastValue;
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestRowIndex = i;
      }
    }
  }

  // 모든 행의 마지막 카드보다 낮음 → 플레이어가 행 선택
  if (bestRowIndex === -1) {
    return { type: "takeRow" };
  }

  return { type: "place", rowIndex: bestRowIndex };
}

// ============ 3. 카드 배치 및 6번째 카드 벌점 처리 ============

/** 배치 처리 결과 */
export interface PlacementResult {
  tableRows: TableRow[];
  cardsCollected: Card[];
  collectedByPlayerId: string | null;
}

/**
 * 카드를 테이블에 배치하고 6번째 카드 벌점 처리
 *
 * - 행에 5장 있을 때 6번째 카드 배치 → 해당 행 5장 수집(벌점) + 행을 새 카드 1장으로 교체
 * - 카드가 모든 행보다 낮을 때 → rowIndex로 선택한 행의 카드 전부 수집 + 행을 새 카드 1장으로 교체
 *
 * @param tableRows 현재 테이블 행 (복사 후 수정하여 반환)
 * @param card 배치할 카드
 * @param playerId 카드를 낸 플레이어 ID
 * @param rowIndex takeRow일 때 플레이어가 선택한 행 (0~3)
 */
export function placeCardAndResolve(
  tableRows: TableRow[],
  card: Card,
  playerId: string,
  rowIndex?: number
): PlacementResult {
  const rows = tableRows.map((row) => [...row]);
  let cardsCollected: Card[] = [];
  let targetRowIndex: number;

  const placement = findRowForCard(card, rows);

  if (placement.type === "takeRow") {
    // 카드가 모든 행보다 낮음 → rowIndex 필수
    if (rowIndex === undefined || rowIndex < 0 || rowIndex > 3) {
      throw new Error("카드가 모든 행보다 낮을 때는 행 선택이 필요합니다.");
    }
    targetRowIndex = rowIndex;
    // 선택한 행의 카드 전부 수집
    cardsCollected = [...rows[targetRowIndex]];
    // 행을 새 카드 1장으로 교체
    rows[targetRowIndex] = [card];
  } else {
    targetRowIndex = placement.rowIndex;
    const row = rows[targetRowIndex];

    if (row.length >= 5) {
      // 6번째 카드 → 기존 5장 수집(벌점) + 행을 새 카드 1장으로 교체
      cardsCollected = [...row];
      rows[targetRowIndex] = [card];
    } else {
      // 5장 미만 → 그냥 추가
      rows[targetRowIndex].push(card);
    }
  }

  return {
    tableRows: rows,
    cardsCollected,
    collectedByPlayerId: cardsCollected.length > 0 ? playerId : null,
  };
}

// ============ 4. 여러 카드 순차 배치 (오름차순) ============

/**
 * 여러 카드를 오름차순으로 순차 배치
 * (한 턴에 여러 플레이어가 낸 카드를 값 순으로 배치)
 *
 * @param tableRows 현재 테이블
 * @param playedCards playerId -> Card 맵 (이 턴에 낸 카드들)
 * @param lowestCardRowChoice 카드가 모든 행보다 낮을 때, 가장 낮은 카드 플레이어가 선택한 행 (0~3)
 */
export function resolveTurn(
  tableRows: TableRow[],
  playedCards: Record<string, Card>,
  lowestCardRowChoice?: number
): {
  tableRows: TableRow[];
  collections: Array<{ playerId: string; cards: Card[] }>;
  placementOrder: PlacementStep[];
} {
  // 카드 값을 기준으로 오름차순 정렬 (낮은 카드부터 배치)
  const sortedEntries = Object.entries(playedCards).sort(
    ([, a], [, b]) => a.id - b.id
  );

  let currentRows = tableRows.map((row) => [...row]);
  const collections: Array<{ playerId: string; cards: Card[] }> = [];
  const placementOrder: PlacementStep[] = [];

  for (const [playerId, card] of sortedEntries) {
    const placement = findRowForCard(card, currentRows);

    const rowIndex =
      placement.type === "takeRow" ? lowestCardRowChoice : undefined;

    if (placement.type === "takeRow" && rowIndex === undefined) {
      throw new Error(
        "카드가 모든 행보다 낮을 때는 lowestCardRowChoice(0~3)가 필요합니다."
      );
    }

    const result = placeCardAndResolve(currentRows, card, playerId, rowIndex);
    currentRows = result.tableRows;

    const targetRowIndex =
      placement.type === "takeRow" ? rowIndex! : placement.rowIndex;
    const cardIndexInRow = currentRows[targetRowIndex].length - 1;
    placementOrder.push({
      card,
      rowIndex: targetRowIndex,
      cardIndexInRow,
    });

    if (result.collectedByPlayerId && result.cardsCollected.length > 0) {
      collections.push({
        playerId: result.collectedByPlayerId,
        cards: result.cardsCollected,
      });
    }
  }

  return { tableRows: currentRows, collections, placementOrder };
}
