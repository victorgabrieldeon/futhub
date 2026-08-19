export type MatchEventType = 'kickoff' | 'goal' | 'yellow_card' | 'red_card' | 'fulltime';

export type LineupCard = Readonly<{
  userCardId: string;
  name: string;
  assignedPosition: string;
  allowedPositions: readonly string[];
  attack: number;
  creation: number;
  defense: number;
  finishing: number;
  passing: number;
  control: number;
  marking: number;
}>;

export type SimulatedMatchEvent = Readonly<{
  minute: number;
  type: MatchEventType;
  playerUserCardId: string | null;
  assistUserCardId: string | null;
  description: string;
  homeGoals: number;
  awayGoals: number;
}>;

export type SimulatedMatch = Readonly<{
  homeGoals: number;
  awayGoals: number;
  events: readonly SimulatedMatchEvent[];
}>;
