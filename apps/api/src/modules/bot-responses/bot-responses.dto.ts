import { z } from 'zod';

// Every template object is strict: the template used to be checked with `typia.equals`.

const componentType = <T extends string>(value: T, description: string) =>
  z.literal(value).meta({ title: 'Tipo do componente', description });

const layerType = <T extends string>(value: T, description: string) =>
  z.literal(value).meta({ title: 'Tipo da camada', description });

const HexColorSchema = z.string().regex(/^(#[0-9A-Fa-f]{6})?$/);

export const BotResponseButtonDtoSchema = z
  .strictObject({
    action: z.string().max(80),
    label: z.string().min(1).max(80),
    style: z.enum(['primary', 'secondary', 'success', 'danger', 'link']),
    url: z.string().max(512),
    disabled: z.boolean(),
    emoji: z
      .string()
      .regex(/^([A-Za-z0-9_]{2,32})?$/)
      .describe('Nome de um emoji do bot exibido antes do rótulo.')
      .optional(),
  })
  .meta({ id: 'BotResponseButtonDto' });
export type BotResponseButtonDto = z.infer<typeof BotResponseButtonDtoSchema>;

export const BotResponseTextDtoSchema = z
  .strictObject({
    type: componentType('text', 'Texto da mensagem.'),
    content: z.string().min(1).max(4000),
  })
  .meta({ id: 'BotResponseTextDto' });
export type BotResponseTextDto = z.infer<typeof BotResponseTextDtoSchema>;

export const BotResponseSeparatorDtoSchema = z
  .strictObject({
    type: componentType('separator', 'Separador visual.'),
    spacing: z.literal([1, 2]),
    divider: z.boolean(),
  })
  .meta({ id: 'BotResponseSeparatorDto' });
export type BotResponseSeparatorDto = z.infer<typeof BotResponseSeparatorDtoSchema>;

export const BotResponseMediaDtoSchema = z
  .strictObject({
    type: componentType('media', 'Imagem da mensagem.'),
    url: z.string().max(2048),
    description: z.string().max(1024),
  })
  .meta({ id: 'BotResponseMediaDto' });
export type BotResponseMediaDto = z.infer<typeof BotResponseMediaDtoSchema>;

export const BotResponseRowDtoSchema = z
  .strictObject({
    type: componentType('row', 'Linha de controles.'),
    buttons: z.array(BotResponseButtonDtoSchema).min(1).max(5),
  })
  .meta({ id: 'BotResponseRowDto' });
export type BotResponseRowDto = z.infer<typeof BotResponseRowDtoSchema>;

const containerChildOptions = [
  BotResponseTextDtoSchema,
  BotResponseSeparatorDtoSchema,
  BotResponseMediaDtoSchema,
  BotResponseRowDtoSchema,
] as const;

export const BotResponseContainerChildDtoSchema = z.discriminatedUnion(
  'type',
  containerChildOptions,
);
export type BotResponseContainerChildDto = z.infer<typeof BotResponseContainerChildDtoSchema>;

export const BotResponseContainerDtoSchema = z
  .strictObject({
    type: componentType('container', 'Grupo de componentes.'),
    color: HexColorSchema,
    // Discord documents 40 total components, including this container and button children.
    components: z.array(BotResponseContainerChildDtoSchema).min(1).max(39),
  })
  .meta({ id: 'BotResponseContainerDto' });
export type BotResponseContainerDto = z.infer<typeof BotResponseContainerDtoSchema>;

export const BotResponseComponentDtoSchema = z.discriminatedUnion('type', [
  ...containerChildOptions,
  BotResponseContainerDtoSchema,
]);
export type BotResponseComponentDto = z.infer<typeof BotResponseComponentDtoSchema>;

export const BotResponseEmbedDtoSchema = z
  .strictObject({
    title: z.string().max(256),
    description: z.string().max(4096),
    color: HexColorSchema,
    footer: z.string().max(2048),
    authorName: z.string().max(256).optional(),
    authorUrl: z.string().max(2048).optional(),
    authorIconUrl: z.string().max(2048).optional(),
    imageUrl: z.string().max(2048),
    thumbnailUrl: z.string().max(2048),
    fields: z
      .array(
        z.strictObject({
          name: z.string().min(1).max(256),
          value: z.string().min(1).max(1024),
          inline: z.boolean(),
        }),
      )
      .max(25),
  })
  .meta({ id: 'BotResponseEmbedDto' });
export type BotResponseEmbedDto = z.infer<typeof BotResponseEmbedDtoSchema>;

const CoordinateSchema = z.number().int().min(-2048).max(4096);
const SizeSchema = z.number().int().min(1).max(4096);
const OpacitySchema = z.number().min(0).max(1);
const CanvasColorSchema = z.string().regex(/^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?)?$/);

const listStyleShape = {
  item: z.string().max(1000),
  separator: z.string().max(20),
  empty: z.string().max(500),
  limit: z.number().int().min(1).max(50),
  more: z.string().max(200),
  prefix: z.string().max(200).describe('Texto antes da lista, só quando ela tem itens.').optional(),
  suffix: z
    .string()
    .max(200)
    .describe('Texto depois da lista, só quando ela tem itens.')
    .optional(),
};

export const BotResponseListStyleDtoSchema = z
  .strictObject(listStyleShape)
  .meta({ id: 'BotResponseListStyleDto' });
export type BotResponseListStyleDto = z.infer<typeof BotResponseListStyleDtoSchema>;

export const BotResponseListFormatDtoSchema = z
  .strictObject({ ...listStyleShape, source: z.string().max(40) })
  .meta({
    id: 'BotResponseListFormatDto',
    description: 'Como uma variável de lista, como `{cards}`, vira texto.',
  });
export type BotResponseListFormatDto = z.infer<typeof BotResponseListFormatDtoSchema>;

export const BotResponseRectLayerDtoSchema = z
  .strictObject({
    type: layerType('rect', 'Retângulo, com gradiente e borda opcionais.'),
    x: CoordinateSchema,
    y: CoordinateSchema,
    w: SizeSchema,
    h: SizeSchema,
    fill: CanvasColorSchema,
    fill2: CanvasColorSchema,
    radius: z.number().int().min(0).max(2048),
    stroke: CanvasColorSchema,
    strokeWidth: z.number().int().min(0).max(64),
    opacity: OpacitySchema,
    progress: z
      .string()
      .max(100)
      .describe('Valor de 0 a 100, como `{percent}`, que encurta a largura (barra de progresso).'),
  })
  .meta({ id: 'BotResponseRectLayerDto' });
export type BotResponseRectLayerDto = z.infer<typeof BotResponseRectLayerDtoSchema>;

export const BotResponseTextLayerDtoSchema = z
  .strictObject({
    type: layerType('text', 'Texto com variáveis, quebra de linha e alinhamento.'),
    x: CoordinateSchema,
    y: CoordinateSchema,
    w: SizeSchema,
    text: z.string().max(500),
    size: z.number().int().min(8).max(240),
    weight: z.literal([400, 600, 800]),
    color: CanvasColorSchema,
    align: z.enum(['left', 'center', 'right']),
    uppercase: z.boolean(),
    lines: z.number().int().min(1).max(10),
    opacity: OpacitySchema,
  })
  .meta({ id: 'BotResponseTextLayerDto' });
export type BotResponseTextLayerDto = z.infer<typeof BotResponseTextLayerDtoSchema>;

export const BotResponseImageLayerDtoSchema = z
  .strictObject({
    type: layerType('image', 'Imagem remota ou de variável, recortada no quadro.'),
    x: CoordinateSchema,
    y: CoordinateSchema,
    w: SizeSchema,
    h: SizeSchema,
    url: z.string().max(2048),
    fit: z.enum(['cover', 'contain']),
    radius: z.number().int().min(0).max(2048),
    opacity: OpacitySchema,
  })
  .meta({ id: 'BotResponseImageLayerDto' });
export type BotResponseImageLayerDto = z.infer<typeof BotResponseImageLayerDtoSchema>;

const itemLayerOptions = [
  BotResponseRectLayerDtoSchema,
  BotResponseTextLayerDtoSchema,
  BotResponseImageLayerDtoSchema,
] as const;

export const BotResponseItemLayerDtoSchema = z.discriminatedUnion('type', itemLayerOptions);
export type BotResponseItemLayerDto = z.infer<typeof BotResponseItemLayerDtoSchema>;

export const BotResponseListLayerDtoSchema = z
  .strictObject({
    type: layerType('list', 'Repete as camadas filhas para cada item de uma lista, em grade.'),
    source: z.string().max(40),
    x: CoordinateSchema,
    y: CoordinateSchema,
    columns: z.number().int().min(1).max(10),
    cellWidth: SizeSchema,
    cellHeight: SizeSchema,
    gapX: z.number().int().min(0).max(512),
    gapY: z.number().int().min(0).max(512),
    limit: z.number().int().min(0).max(50),
    layers: z.array(BotResponseItemLayerDtoSchema).max(20),
  })
  .meta({ id: 'BotResponseListLayerDto' });
export type BotResponseListLayerDto = z.infer<typeof BotResponseListLayerDtoSchema>;

export const BotResponseImageDtoSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
    width: z.number().int().min(64).max(2048),
    height: z.number().int().min(64).max(2048),
    background: CanvasColorSchema,
    layers: z
      .array(z.discriminatedUnion('type', [...itemLayerOptions, BotResponseListLayerDtoSchema]))
      .max(60),
  })
  .meta({
    id: 'BotResponseImageDto',
    description: 'Imagem gerada pelo bot; mensagens a usam como `attachment://<id>.png`.',
  });
export type BotResponseImageDto = z.infer<typeof BotResponseImageDtoSchema>;

export const BotResponseTemplateDtoSchema = z
  .strictObject({
    mode: z.enum(['legacy', 'components_v2']),
    content: z.string().max(2000),
    embeds: z.array(BotResponseEmbedDtoSchema).max(10),
    components: z.array(BotResponseComponentDtoSchema).max(40),
    lists: z.array(BotResponseListFormatDtoSchema).max(10).optional(),
    images: z.array(BotResponseImageDtoSchema).max(4).optional(),
  })
  .meta({ id: 'BotResponseTemplateDto' });
export type BotResponseTemplateDto = z.infer<typeof BotResponseTemplateDtoSchema>;

export const BotResponseDefinitionDtoSchema = z
  .object({
    key: z.string(),
    command: z.string(),
    label: z.string(),
    description: z.string(),
    variables: z.array(
      z.object({ token: z.string(), description: z.string(), example: z.string() }),
    ),
    lists: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        fields: z.array(z.object({ name: z.string(), description: z.string() })),
        examples: z.array(z.record(z.string(), z.string())),
        defaultFormat: BotResponseListStyleDtoSchema,
      }),
    ),
    actions: z.array(z.object({ id: z.string(), label: z.string(), description: z.string() })),
    defaultTemplate: BotResponseTemplateDtoSchema,
  })
  .meta({ id: 'BotResponseDefinitionDto' });
export type BotResponseDefinitionDto = z.infer<typeof BotResponseDefinitionDtoSchema>;
