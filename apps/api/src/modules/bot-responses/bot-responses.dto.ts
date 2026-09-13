import type { tags } from 'typia';

export interface BotResponseButtonDto {
  action: string & tags.MaxLength<80>;
  label: string & tags.MinLength<1> & tags.MaxLength<80>;
  style: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  url: string & tags.MaxLength<512>;
  disabled: boolean;
}

export interface BotResponseTextDto {
  /**
   * Texto da mensagem.
   * @title Tipo do componente
   */
  type: 'text';
  content: string & tags.MinLength<1> & tags.MaxLength<4000>;
}

export interface BotResponseSeparatorDto {
  /**
   * Separador visual.
   * @title Tipo do componente
   */
  type: 'separator';
  spacing: 1 | 2;
  divider: boolean;
}

export interface BotResponseMediaDto {
  /**
   * Imagem da mensagem.
   * @title Tipo do componente
   */
  type: 'media';
  url: string & tags.MaxLength<2048>;
  description: string & tags.MaxLength<1024>;
}

export interface BotResponseRowDto {
  /**
   * Linha de controles.
   * @title Tipo do componente
   */
  type: 'row';
  buttons: BotResponseButtonDto[] & tags.MinItems<1> & tags.MaxItems<5>;
}

export type BotResponseContainerChildDto =
  | BotResponseTextDto
  | BotResponseSeparatorDto
  | BotResponseMediaDto
  | BotResponseRowDto;

export interface BotResponseContainerDto {
  /**
   * Grupo de componentes.
   * @title Tipo do componente
   */
  type: 'container';
  color: string & tags.Pattern<'^(#[0-9A-Fa-f]{6})?$'>;
  // Discord documents 40 total components, including this container and button children.
  components: BotResponseContainerChildDto[] & tags.MinItems<1> & tags.MaxItems<39>;
}

export type BotResponseComponentDto = BotResponseContainerChildDto | BotResponseContainerDto;

export interface BotResponseEmbedDto {
  title: string & tags.MaxLength<256>;
  description: string & tags.MaxLength<4096>;
  color: string & tags.Pattern<'^(#[0-9A-Fa-f]{6})?$'>;
  footer: string & tags.MaxLength<2048>;
  authorName?: string & tags.MaxLength<256>;
  authorUrl?: string & tags.MaxLength<2048>;
  authorIconUrl?: string & tags.MaxLength<2048>;
  imageUrl: string & tags.MaxLength<2048>;
  thumbnailUrl: string & tags.MaxLength<2048>;
  fields: {
    name: string & tags.MinLength<1> & tags.MaxLength<256>;
    value: string & tags.MinLength<1> & tags.MaxLength<1024>;
    inline: boolean;
  }[] &
    tags.MaxItems<25>;
}

export interface BotResponseTemplateDto {
  mode: 'legacy' | 'components_v2';
  content: string & tags.MaxLength<2000>;
  embeds: BotResponseEmbedDto[] & tags.MaxItems<10>;
  components: BotResponseComponentDto[] & tags.MaxItems<40>;
}

export interface BotResponseDefinitionDto {
  key: string;
  command: string;
  label: string;
  description: string;
  variables: { token: string; description: string; example: string }[];
  actions: { id: string; label: string; description: string }[];
  defaultTemplate: BotResponseTemplateDto;
}
