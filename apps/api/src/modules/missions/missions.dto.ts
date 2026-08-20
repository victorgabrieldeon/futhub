import type { tags } from 'typia';

export interface MissionsRequest {
  id: string & tags.MinLength<1> & tags.MaxLength<80>;
  name: string & tags.MinLength<1> & tags.MaxLength<80>;
  avatarUrl: (string & tags.Format<'url'> & tags.MaxLength<2048>) | null;
}

export interface MissionsResponse {
  missions: MissionDto[];
}

export interface MissionDto {
  id: string & tags.Format<'uuid'>;
  title: string;
  type: 'open_pack' | 'sell_player' | 'claim_profit' | 'play_match';
  cadence: 'daily' | 'weekly' | 'monthly';
  tier: number & tags.Minimum<1>;
  goal: number & tags.Minimum<1>;
  progress: number & tags.Minimum<0>;
  completed: boolean;
  claimed: boolean;
  expiresAt: string & tags.Format<'date-time'>;
  reward: MissionRewardDto | null;
}

export interface MissionRewardDto {
  itemId: string & tags.Format<'uuid'>;
  type: 'card' | 'pack' | 'balance' | 'field' | 'premium';
  quantity: number & tags.Minimum<1>;
  resourceId: (string & tags.Format<'uuid'>) | null;
}
