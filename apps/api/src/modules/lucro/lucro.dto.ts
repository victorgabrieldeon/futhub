import type { tags } from 'typia';

import type { ProgressionDto } from '../progression/progression.dto.js';

export interface LucroEmbedDto {
  title: string;
  description: string;
  color: string;
  footer: string;
}

export interface DiscordIdentityDto {
  id: string & tags.MinLength<1> & tags.MaxLength<80>;
  name: string & tags.MinLength<1> & tags.MaxLength<80>;
  avatarUrl: (string & tags.Format<'url'> & tags.MaxLength<2048>) | null;
}

export type LucroResponse = LucroSuccessResponse | LucroCooldownResponse;

export interface LucroSuccessResponse {
  /**
   * Resultado com recompensa concedida.
   *
   * @title Tipo do resultado
   */
  kind: 'success';
  reward: LucroRewardDto;
  balance: number;
  availableAt: string & tags.Format<'date-time'>;
  progression: ProgressionDto;
  embed: LucroEmbedDto;
}

export interface LucroRewardDto {
  readonly value: number;
  readonly weight: number;
  readonly message: string;
}

export interface LucroCooldownResponse {
  /**
   * Resultado com cooldown ainda ativo.
   *
   * @title Tipo do resultado
   */
  kind: 'cooldown';
  availableAt: string & tags.Format<'date-time'>;
}
