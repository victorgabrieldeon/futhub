import type { tags } from 'typia';

import type { ProgressionDto } from '../progression/progression.dto.js';

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
  embed: CommandEmbedDto;
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

export interface CommandEmbedDto {
  title: string & tags.MinLength<1> & tags.MaxLength<256>;
  description: string & tags.MinLength<1> & tags.MaxLength<4096>;
  color: string & tags.Pattern<'^#[0-9A-Fa-f]{6}$'>;
  footer: string & tags.MaxLength<2048>;
}

export interface CommandSchemaProperty {
  type: string;
  description: string;
  minLength?: number & tags.Type<'int32'> & tags.Minimum<0>;
  maxLength?: number & tags.Type<'int32'> & tags.Minimum<0>;
  pattern?: string;
  examples: string[] & tags.MinItems<1>;
}

export interface CommandSchemaVariable {
  token: string;
  description: string;
  example: string;
}

export interface CommandDataSchema {
  $schema: string;
  title: string;
  description: string;
  type: string;
  properties: Record<string, CommandSchemaProperty>;
  required: string[];
  additionalProperties: boolean;
  examples: Record<string, string>[] & tags.MinItems<1>;
  variables: CommandSchemaVariable[] & tags.MinItems<1>;
}

export interface CommandContextProperty {
  type: string;
  description: string;
  format?: string;
  example: string;
}

export interface CommandContextSchema {
  $schema: string;
  title: string;
  description: string;
  type: string;
  properties: Record<string, CommandContextProperty>;
  required: string[];
  additionalProperties: boolean;
}

export interface CommandUtility {
  name: string;
  signature: string;
  description: string;
  example: string;
}

export interface CommandContractResponse {
  data: CommandDataSchema;
  contexto: CommandContextSchema;
  utilities: CommandUtility[] & tags.MinItems<1>;
}

export interface AdminLucroRewardMessagesDto {
  pt: string & tags.MinLength<1> & tags.MaxLength<280>;
  es: string & tags.MinLength<1> & tags.MaxLength<280>;
  en: string & tags.MinLength<1> & tags.MaxLength<280>;
}

export interface AdminLucroRewardDto {
  id: string & tags.Format<'uuid'>;
  value: number & tags.Type<'int32'> & tags.Minimum<1>;
  weight: number & tags.Type<'int32'> & tags.Minimum<1>;
  messages: AdminLucroRewardMessagesDto;
}

export interface AdminLucroConfigResponse {
  cooldownSeconds: number & tags.Type<'int32'> & tags.Minimum<1>;
  rewards: AdminLucroRewardDto[] & tags.MinItems<1>;
  embed: CommandEmbedDto;
}

export interface UpdateLucroConfigRequest {
  cooldownSeconds: number & tags.Type<'int32'> & tags.Minimum<1>;
  rewards: Omit<AdminLucroRewardDto, 'id'>[] & tags.MinItems<1>;
  embed: CommandEmbedDto;
}
