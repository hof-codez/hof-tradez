import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_VOTES, consensusFor, outcomeWord } from './history.ts';

test('under the minimum it stays pending and shows progress', () => {
  const c = consensusFor({ aWon: 1, even: 0, bWon: 1, total: 2 }, 'Sam', 'Lee');
  assert.equal(c.state, 'pending');
  assert.equal(c.text, 'Pending more voting results');
  assert.ok(c.detail.includes(`2 of ${MIN_VOTES}`));
});

test('plurality decides and wording is the league view, not a percentage', () => {
  const a = consensusFor({ aWon: 4, even: 1, bWon: 1, total: 6 }, 'Sam', 'Lee');
  assert.equal(a.state, 'a');
  assert.ok(a.text.includes('leans toward Sam'));
  assert.ok(!/%/.test(a.text + a.detail));
  assert.equal(consensusFor({ aWon: 0, even: 1, bWon: 3, total: 4 }, 'Sam', 'Lee').state, 'b');
  assert.equal(consensusFor({ aWon: 0, even: 3, bWon: 1, total: 4 }, 'Sam', 'Lee').state, 'even');
});

test('ties are called split', () => {
  assert.equal(consensusFor({ aWon: 2, even: 0, bWon: 2, total: 4 }, 'Sam', 'Lee').state, 'split');
});

test('outcome numbers map to words', () => {
  assert.equal(outcomeWord(1), 'a');
  assert.equal(outcomeWord(0), 'even');
  assert.equal(outcomeWord(-1), 'b');
});
