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
  fullWeightVotes: number;
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
  trades?: number; // recent league trades this team was part of (from the trade feed)
}

export interface SelfPreview {
  totalVotes: number;
  confidence: 'none' | 'early' | 'solid';
  traits: Trait[];
  lean: Record<string, number>;
}

export type Milestone = 'early' | 'solid' | 'weight' | null;

export type DeskItem =
  | { kind: 'offer'; receive: BallotAsset[]; give: BallotAsset[]; exp: number; sig: string; votesLeft: number }
  | { kind: 'real'; id: string; year: number; aGave: BallotAsset[]; bGave: BallotAsset[]; votesLeft: number };

export interface RealSplit {
  aWon: number;
  even: number;
  bWon: number;
  total: number;
}

export interface VoteResult {
  ok: true;
  votesLeft: number;
  dayVotes: number;
  weight: number;
  milestone: Milestone;
  preview: SelfPreview;
  split?: RealSplit | null;
}
