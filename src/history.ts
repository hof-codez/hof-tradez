// How the league currently sees one past trade, from how owners voted on it.
// Needs a few votes before it says anything, and it can change as more arrive.
export const MIN_VOTES = 3;

export interface Split { aWon: number; even: number; bWon: number; total: number }

export type ConsensusState = 'pending' | 'a' | 'b' | 'even' | 'split';

export interface Consensus {
  state: ConsensusState;
  text: string;
  detail: string;
}

export function consensusFor(split: Split, nameA: string, nameB: string): Consensus {
  if (split.total < MIN_VOTES) {
    return {
      state: 'pending',
      text: 'Pending more voting results',
      detail: `${split.total} of ${MIN_VOTES} votes so far`,
    };
  }
  const top = Math.max(split.aWon, split.even, split.bWon);
  const leaders = [split.aWon === top, split.even === top, split.bWon === top].filter(Boolean).length;
  const detail = `${top} of ${split.total} votes`;
  if (leaders > 1) return { state: 'split', text: 'The league is split on this one', detail: `${split.total} votes so far` };
  if (split.even === top) return { state: 'even', text: 'The league consensus sees this as an even trade', detail };
  return split.aWon === top
    ? { state: 'a', text: `The league consensus leans toward ${nameA}`, detail }
    : { state: 'b', text: `The league consensus leans toward ${nameB}`, detail };
}

export const outcomeWord = (o: number): 'a' | 'even' | 'b' => (o === 1 ? 'a' : o === 0 ? 'even' : 'b');
