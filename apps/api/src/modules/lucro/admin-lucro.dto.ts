import type { tags } from 'typia';

export interface LucroMessagesDto {
  pt: string & tags.MinLength<1> & tags.MaxLength<280>;
  es: string & tags.MinLength<1> & tags.MaxLength<280>;
  en: string & tags.MinLength<1> & tags.MaxLength<280>;
}

export interface LucroRewardInputDto {
  value: number & tags.Type<'int32'> & tags.Minimum<1>;
  weight: number & tags.Type<'int32'> & tags.Minimum<1>;
  messages: LucroMessagesDto;
}

export interface LucroEmbedDto {
  title: string & tags.MinLength<1> & tags.MaxLength<256>;
  description: string & tags.MinLength<1> & tags.MaxLength<4_000>;
  color: string & tags.Pattern<'^#[0-9A-Fa-f]{6}$'>;
  footer: string & tags.MaxLength<2_048>;
}

export interface LucroConfigInputDto {
  cooldownSeconds: number & tags.Type<'int32'> & tags.Minimum<1>;
  rewards: LucroRewardInputDto[] & tags.MinItems<1>;
  embed: LucroEmbedDto;
}

export interface LucroRewardDto extends LucroRewardInputDto {
  id: string & tags.Format<'uuid'>;
}

export interface LucroConfigDto {
  cooldownSeconds: number;
  rewards: LucroRewardDto[];
  embed: LucroEmbedDto;
}

export interface LucroEmbedSchemaDto {
  description: string;
  variables: Array<{ token: string; description: string; example: string }>;
  properties: {
    title: { maxLength: number; examples: string[] };
    description: { maxLength: number; examples: string[] };
    color: { maxLength: number; examples: string[] };
    footer: { maxLength: number; examples: string[] };
  };
}
