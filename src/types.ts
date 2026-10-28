export interface Asset {
  id: string;
  kind: 'player' | 'pick';
  name: string;
  position: string | null;
  team: string | null;
  age: number | null;
  pickYear: number | null;
  pickRound: number | null;
  value: number;
}

export type BallotAsset = Omit<Asset, 'value'>;

export interface ValuesPayload {
  version: number;
  windowEndsAt: string;
  publishedAt: string;
  starPremium: number;
  maxVotesPerDay: number;
  votesLeft: number;
  unchanged?: boolean;
  assets?: Asset[];
}

export interface TeamOption {
  id: string;
  name: string;
  claimed: boolean;
}

export interface Trait {
  key: string;
  label: string;
  detail: string;
}

export interface LeagueTeam {
  teamId: string;
  name: string;
  roster: string[];
  confidence: 'none' | 'early' | 'solid';
  traits: Trait[];
  lean: Record<string, number>;
}
