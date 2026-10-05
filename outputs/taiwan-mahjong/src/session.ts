import type { GameState, Intent, Seat } from './model.js';
import { createGame, legalActions, applyAction, getObservation, restore, serialize } from './engine.js';
import { chooseAction } from './ai.js';

export type Session = { schemaVersion: 1; game: GameState; aiRandom: number[] };
const validRandom = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 0xffffffff;

export function createSession(options: Parameters<typeof createGame>[0] = {}): Session {
  return { schemaVersion: 1, game: createGame(options), aiRandom: Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n || 1) };
}
export function automaticAction(session: Session): { actor: Seat | 'engine'; intent: Intent; randomState?: number; reason?: string } | null {
  const game = session.game;
  if (game.phase === 'handResult' || game.phase === 'matchResult') return null;
  const flow = legalActions(game, 'engine')[0];
  if (flow) return { actor: 'engine', intent: flow };
  if (legalActions(game, 0).length) return null;
  for (const seat of [1, 2, 3] as Seat[]) {
    const observation = getObservation(game, seat);
    if (!observation.legalActions.length) continue;
    const decision = chooseAction(observation, observation.legalActions, session.aiRandom[seat - 1]);
    return { actor: seat, ...decision };
  }
  return null;
}
export function advance(session: Session, actor: Seat | 'engine', intent: Intent, expectedVersion: number, randomState?: number): Session {
  if (randomState !== undefined && (!validRandom(randomState) || actor === 'engine' || actor === 0)) throw new Error('INVALID_AI_RANDOM');
  const result = applyAction(session.game, {
    opId: `${session.game.handId}:${expectedVersion}:${actor}`, matchId: session.game.matchId,
    handId: session.game.handId, version: expectedVersion, actor, intent,
  });
  if (!result.ok) throw new Error(result.error);
  const aiRandom = [...session.aiRandom];
  if (randomState !== undefined && actor !== 'engine') aiRandom[actor - 1] = randomState;
  return { schemaVersion: 1, game: result.state, aiRandom };
}
export function encodeSession(session: Session): string {
  if (session.schemaVersion !== 1 || !Array.isArray(session.aiRandom) || session.aiRandom.length !== 3 || !session.aiRandom.every(validRandom)) throw new Error('INVALID_SESSION');
  serialize(session.game);
  return JSON.stringify(session);
}
export function decodeSession(text: string): Session {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SESSION');
  const saved = value as Session;
  if (saved.schemaVersion !== 1 || !Array.isArray(saved.aiRandom) || saved.aiRandom.length !== 3 || !saved.aiRandom.every(validRandom)) throw new Error('INVALID_SESSION');
  return { schemaVersion: 1, game: restore(JSON.stringify(saved.game)), aiRandom: [...saved.aiRandom] };
}
