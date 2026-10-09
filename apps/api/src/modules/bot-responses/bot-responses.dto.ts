import type { tags } from 'typia';

export interface BotResponseButtonDto {
  action: string & tags.MaxLength<80>;
  label: string & tags.MinLength<1> & tags.MaxLength<80>;
  style: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  url: string & tags.MaxLength<512>;
  disabled: boolean;
  /** Nome de um emoji do bot exibido antes do rótulo. */
  emoji?: string & tags.Pattern<'^([A-Za-z0-9_]{2,32})?$'>;
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

type Coordinate = number & tags.Type<'int32'> & tags.Minimum<-2048> & tags.Maximum<4096>;
type Size = number & tags.Type<'int32'> & tags.Minimum<1> & tags.Maximum<4096>;
type Opacity = number & tags.Minimum<0> & tags.Maximum<1>;
type CanvasColor = string & tags.Pattern<'^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?)?$'>;

export interface BotResponseListStyleDto {
  item: string & tags.MaxLength<1000>;
  separator: string & tags.MaxLength<20>;
  empty: string & tags.MaxLength<500>;
  limit: number & tags.Type<'uint32'> & tags.Minimum<1> & tags.Maximum<50>;
  more: string & tags.MaxLength<200>;
  /** Texto antes da lista, só quando ela tem itens. */
  prefix?: string & tags.MaxLength<200>;
  /** Texto depois da lista, só quando ela tem itens. */
  suffix?: string & tags.MaxLength<200>;
}

/** Como uma variável de lista, como `{cards}`, vira texto. */
export interface BotResponseListFormatDto extends BotResponseListStyleDto {
  source: string & tags.MaxLength<40>;
}

export interface BotResponseRectLayerDto {
  /**
   * Retângulo, com gradiente e borda opcionais.
   * @title Tipo da camada
   */
  type: 'rect';
  x: Coordinate;
  y: Coordinate;
  w: Size;
  h: Size;
  fill: CanvasColor;
  fill2: CanvasColor;
  radius: number & tags.Type<'uint32'> & tags.Maximum<2048>;
  stroke: CanvasColor;
  strokeWidth: number & tags.Type<'uint32'> & tags.Maximum<64>;
  opacity: Opacity;
  /** Valor de 0 a 100, como `{percent}`, que encurta a largura (barra de progresso). */
  progress: string & tags.MaxLength<100>;
}

export interface BotResponseTextLayerDto {
  /**
   * Texto com variáveis, quebra de linha e alinhamento.
   * @title Tipo da camada
   */
  type: 'text';
  x: Coordinate;
  y: Coordinate;
  w: Size;
  text: string & tags.MaxLength<500>;
  size: number & tags.Type<'uint32'> & tags.Minimum<8> & tags.Maximum<240>;
  weight: 400 | 600 | 800;
  color: CanvasColor;
  align: 'left' | 'center' | 'right';
  uppercase: boolean;
  lines: number & tags.Type<'uint32'> & tags.Minimum<1> & tags.Maximum<10>;
  opacity: Opacity;
}

export interface BotResponseImageLayerDto {
  /**
   * Imagem remota ou de variável, recortada no quadro.
   * @title Tipo da camada
   */
  type: 'image';
  x: Coordinate;
  y: Coordinate;
  w: Size;
  h: Size;
  url: string & tags.MaxLength<2048>;
  fit: 'cover' | 'contain';
  radius: number & tags.Type<'uint32'> & tags.Maximum<2048>;
  opacity: Opacity;
}

export type BotResponseItemLayerDto =
  | BotResponseRectLayerDto
  | BotResponseTextLayerDto
  | BotResponseImageLayerDto;

export interface BotResponseListLayerDto {
  /**
   * Repete as camadas filhas para cada item de uma lista, em grade.
   * @title Tipo da camada
   */
  type: 'list';
  source: string & tags.MaxLength<40>;
  x: Coordinate;
  y: Coordinate;
  columns: number & tags.Type<'uint32'> & tags.Minimum<1> & tags.Maximum<10>;
  cellWidth: Size;
  cellHeight: Size;
  gapX: number & tags.Type<'uint32'> & tags.Maximum<512>;
  gapY: number & tags.Type<'uint32'> & tags.Maximum<512>;
  limit: number & tags.Type<'uint32'> & tags.Maximum<50>;
  layers: BotResponseItemLayerDto[] & tags.MaxItems<20>;
}

/** Imagem gerada pelo bot; mensagens a usam como `attachment://<id>.png`. */
export interface BotResponseImageDto {
  id: string & tags.Pattern<'^[a-z0-9][a-z0-9-]{0,31}$'>;
  width: number & tags.Type<'uint32'> & tags.Minimum<64> & tags.Maximum<2048>;
  height: number & tags.Type<'uint32'> & tags.Minimum<64> & tags.Maximum<2048>;
  background: CanvasColor;
  layers: (BotResponseItemLayerDto | BotResponseListLayerDto)[] & tags.MaxItems<60>;
}

export interface BotResponseTemplateDto {
  mode: 'legacy' | 'components_v2';
  content: string & tags.MaxLength<2000>;
  embeds: BotResponseEmbedDto[] & tags.MaxItems<10>;
  components: BotResponseComponentDto[] & tags.MaxItems<40>;
  lists?: BotResponseListFormatDto[] & tags.MaxItems<10>;
  images?: BotResponseImageDto[] & tags.MaxItems<4>;
}

export interface BotResponseDefinitionDto {
  key: string;
  command: string;
  label: string;
  description: string;
  variables: { token: string; description: string; example: string }[];
  lists: {
    name: string;
    description: string;
    fields: { name: string; description: string }[];
    examples: Record<string, string>[];
    defaultFormat: BotResponseListStyleDto;
  }[];
  actions: { id: string; label: string; description: string }[];
  defaultTemplate: BotResponseTemplateDto;
}
