export type Seat = 0 | 1 | 2 | 3;
export type TileKind = string;
export type TileId = string;
export type MeldKind = 'chi' | 'pon' | 'exposedKong' | 'concealedKong' | 'addedKong';
export type Meld = { meldId: string; kind: MeldKind; tiles: TileId[]; fromSeat: Seat | null; sourceEvent: number };
export type Intent =
  | { type: 'DEAL' | 'DRAW' | 'REPLACE' | 'RESOLVE' | 'NEXT_HAND' }
  | { type: 'DISCARD'; tileId: TileId }
  | { type: 'CHI' | 'PON' | 'KAN_OPEN'; windowId: string; ownTiles: TileId[] }
  | { type: 'KAN_CLOSED'; ownTiles: TileId[] }
  | { type: 'KAN_ADDED'; meldId: string; tileId: TileId }
  | { type: 'WIN'; source: 'selfDraw' | 'ron' | 'robKong'; windowId?: string }
  | { type: 'PASS'; windowId: string };
export type Action = { opId: string; matchId: string; handId: number; version: number; actor: Seat | 'engine'; intent: Intent };
export type Phase = 'setup' | 'initialFlowers' | 'awaitDraw' | 'awaitDiscard' | 'awaitClaims' | 'awaitRobKong' | 'awaitReplacement' | 'handResult' | 'matchResult';
export type Player = {
  concealed: TileId[]; melds: Meld[]; flowers: TileId[];
  discardHistory: { tileId: TileId; eventSeq: number; claimedBy: Seat | null }[];
  restrictions: { passedWin: boolean; passedPon: TileKind[]; lastDiscard: TileKind | null; forbiddenDiscards: TileKind[] };
};
export type Decomposition = { pair: TileKind; groups: { kind: 'sequence' | 'triplet'; tiles: TileKind[] }[] };
export type ScoreItem = { id: string; tai: number; reason: string };
export type ScoreResult = { tai: number; items: ScoreItem[]; excluded: string[]; decomposition: Decomposition | null };
export type ScoreInput = {
  // Complete effective-17 hand; external winning tile already included exactly once.
  concealed: TileKind[]; melds: Meld[]; flowers: TileKind[]; winningTile: TileKind | null;
  source: 'selfDraw' | 'ron' | 'robKong'; seatWind: TileKind; roundWind: TileKind;
  heavenly?: boolean; earthly?: boolean; human?: boolean; afterReplacement?: boolean; lastAvailable?: boolean;
};
export type ClaimWindow = {
  kind: 'discard' | 'robKong'; windowId: string; sourceSeat: Seat; tileId: TileId; meldId?: string;
  options: Partial<Record<Seat, Intent[]>>; responses: Partial<Record<Seat, Intent>>;
};
export type GameState = {
  schemaVersion: 1; rulesVersion: 'TW16-CLASSIC-v1'; matchId: string; handId: number; version: number; eventSeq: number;
  initialDealer: Seat; dealer: Seat; dealerAdvances: number; roundWind: TileKind; streak: number; scores: number[];
  wall: { order: TileId[]; head: number; tail: number; reserveCount: 16 };
  wallRandom: number;
  players: Player[]; phase: Phase; turn: Seat;
  drawContext: { source: 'deal' | 'normal' | 'claim' | 'exposedKong' | 'concealedKong' | 'addedKong'; lastTile: TileId | null; replacement: boolean; selfDrawForbidden: boolean };
  openingContext: { draws: number[]; discards: number[]; interrupted: boolean };
  pending: ClaimWindow | { kind: 'initialFlowers'; queue: Seat[]; later: Seat[] } | null;
  acceptedOpIds: string[];
  settlement: null | { id: string; winner: Seat | null; source: 'draw' | 'selfDraw' | 'ron' | 'robKong' | 'sevenFlowers' | 'eightFlowers'; score: ScoreResult | null; delta: number[]; externalTile: TileId | null };
};
