import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSession, encodeSession } from '../dist/session.js';
import { fixture, discard } from './fixtures.mjs';

// Fully legal test-only snapshots: the human has 1, 3, 4 and the previous seat discards 2.
export function chiFixture(suit, seat = 0, options = {}) {
  const source = (seat + 3) % 4;
  const hand = `134${suit} ${['m', 'p', 's'].filter(s => s !== suit).map(s => `147${s}`).join(' ')} 1234567z`;
  return discard(fixture({ turn: source, hands: { [seat]: hand, [source]: `2${suit}` }, ...options }), source, `2${suit}`);
}

export function createChiFixtures() {
  return ['m', 'p', 's'].map(suit => ({
    name: `chi134-${suit}`,
    session: decodeSession(encodeSession({ schemaVersion: 1, game: chiFixture(suit), aiRandom: [17, 29, 43] })),
  }));
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('./chi-fixtures.json', import.meta.url), JSON.stringify(createChiFixtures(), null, 2) + '\n');
  console.log('Saved 3 M3.1 chi fixtures.');
}
