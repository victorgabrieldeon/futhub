// Wire shape of a bot response. The API mirrors these with typia tags in bot-responses.dto.ts.

export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';

export interface TemplateButton {
  action: string;
  label: string;
  style: ButtonStyle;
  url: string;
  disabled: boolean;
  /** Name of an application emoji shown before the label. */
  emoji?: string;
}

export interface TextComponent {
  type: 'text';
  content: string;
}

export interface SeparatorComponent {
  type: 'separator';
  spacing: 1 | 2;
  divider: boolean;
}

export interface MediaComponent {
  type: 'media';
  url: string;
  description: string;
}

export interface RowComponent {
  type: 'row';
  buttons: TemplateButton[];
}

export type ContainerChild = TextComponent | SeparatorComponent | MediaComponent | RowComponent;

export interface ContainerComponent {
  type: 'container';
  color: string;
  components: ContainerChild[];
}

export type TemplateComponent = ContainerChild | ContainerComponent;

export interface TemplateEmbed {
  title: string;
  description: string;
  color: string;
  footer: string;
  authorName?: string;
  authorUrl?: string;
  authorIconUrl?: string;
  imageUrl: string;
  thumbnailUrl: string;
  fields: { name: string; value: string; inline: boolean }[];
}

/** How a list variable such as `{cards}` becomes text. */
export interface ListFormat {
  source: string;
  /** Rendered once per item; item fields, `{index}` and scalar variables are available. */
  item: string;
  separator: string;
  /** Rendered instead of the list when it has no items. */
  empty: string;
  limit: number;
  /** Appended when items were cut by `limit`; `{rest}` and `{total}` are available. */
  more: string;
  /** Wrap the list only when it has items, e.g. " Recompensas: " … ".". */
  prefix?: string;
  suffix?: string;
}

export interface RectLayer {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  /** Second gradient stop; empty draws a solid fill. */
  fill2: string;
  radius: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  /** Optional 0–100 value such as `{percent}`; scales the width to draw a progress bar. */
  progress: string;
}

export interface TextLayer {
  type: 'text';
  x: number;
  y: number;
  w: number;
  text: string;
  size: number;
  weight: 400 | 600 | 800;
  color: string;
  align: 'left' | 'center' | 'right';
  uppercase: boolean;
  lines: number;
  opacity: number;
}

export interface ImageLayer {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  fit: 'cover' | 'contain';
  radius: number;
  opacity: number;
}

export type ItemLayer = RectLayer | TextLayer | ImageLayer;

/** Repeats its child layers for each list item, laid out in a grid of cells. */
export interface ListLayer {
  type: 'list';
  source: string;
  x: number;
  y: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  limit: number;
  layers: ItemLayer[];
}

export type CanvasLayer = ItemLayer | ListLayer;

/** A generated image. Messages reference it as `attachment://<id>.png`. */
export interface CanvasImage {
  id: string;
  width: number;
  height: number;
  background: string;
  layers: CanvasLayer[];
}

export interface Template {
  mode: 'legacy' | 'components_v2';
  content: string;
  embeds: TemplateEmbed[];
  components: TemplateComponent[];
  lists?: ListFormat[];
  images?: CanvasImage[];
}

export interface VariableDefinition {
  token: string;
  description: string;
  example: string;
}

export interface ListDefinition {
  name: string;
  description: string;
  fields: { name: string; description: string }[];
  examples: Record<string, string>[];
  defaultFormat: Omit<ListFormat, 'source'>;
}

export interface Definition {
  key: string;
  command: string;
  label: string;
  description: string;
  variables: VariableDefinition[];
  lists: ListDefinition[];
  actions: { id: string; label: string; description: string }[];
  defaultTemplate: Template;
}

export type ListItem = Record<string, string>;
/** Runtime values: scalars for `{name}` tokens and item arrays for list tokens. */
export type TemplateData = Record<string, string | ListItem[]>;
