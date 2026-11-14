import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  type StandardSchemaConverter,
  SwaggerModule,
} from '@nestjs/swagger';
import { z } from 'zod';

const tags: [name: string, description: string][] = [
  ['Administração / Cards', 'Catálogo, coleções, times e imagens de cards.'],
  ['Administração / Lucro', 'Configuração do comando de lucro.'],
  ['Administração / Packs', 'Gerenciamento de packs e imagens.'],
  ['Administração / Códigos de resgate', 'Códigos promocionais e o Item concedido por eles.'],
  ['Administração / Missões', 'Missões diárias, semanais e mensais e o pool de recompensas.'],
  ['Administração / Sessão', 'Sessão autenticada da área administrativa.'],
  ['Administração / Assistente IA', 'Assistente que propõe Times, Coleções, Cards e Packs.'],
  ['Administração / Assistente IA streaming', 'Variantes SSE do assistente; fora do SDK gerado.'],
  ['Administração / Usuários', 'Perfil, saldo, cards, packs, campos e banimento de jogadores.'],
  ['Administração / Respostas do bot', 'Edição dos templates de resposta do bot Discord.'],
  ['Respostas do bot', 'Templates configuráveis de resposta do bot Discord.'],
  ['Emojis do bot', 'Emojis da aplicação Discord usados nas respostas do bot.'],
  ['Clube', 'Gestão financeira e estrutura do clube.'],
  ['Autenticação do jogador', 'Sessão do jogador no app web e na Activity do Discord.'],
  ['Comandos', 'Comandos executados por jogadores.'],
  ['Liga', 'Fila ranqueada, classificação e partidas.'],
  ['Mercado de cards', 'Compra e venda de cards de jogadores.'],
  ['Missões', 'Missões disponíveis para jogador.'],
  ['Packs', 'Compra e abertura de packs.'],
  ['Saúde', 'Estado do serviço.'],
  ['Time', 'Inventário, escalação, formação e tática do jogador.'],
];

// z.date() has no JSON Schema form; on the wire it is an ISO string.
const zodSchemaConverter: StandardSchemaConverter = (schema, { schemaType }) => {
  if (!(schema instanceof z.ZodType)) return undefined;
  const { definitions, ...root } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: schemaType,
    unrepresentable: 'any',
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === 'date')
        Object.assign(jsonSchema, { type: 'string', format: 'date-time' });
    },
  }) as Record<string, unknown> & { definitions?: Record<string, unknown> };
  return { schema: root, components: definitions };
};

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setOpenAPIVersion('3.0.3')
    .setTitle('FutHub API')
    .setVersion('1.0')
    .setDescription('API do FutHub para jogo, automações Discord e administração.')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer');
  for (const [name, description] of tags) builder.addTag(name, description);
  const document = SwaggerModule.createDocument(app, builder.build(), {
    standardSchemaConverter: zodSchemaConverter,
    operationIdFactory: () => '',
  });
  // SDK function and type names come from operationId: every route must name itself.
  const anonymous = Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(
        ([, operation]) => typeof operation === 'object' && operation && !operation.operationId,
      )
      .map(([method]) => `${method.toUpperCase()} ${path}`),
  );
  if (anonymous.length)
    throw new Error(`Rotas sem @ApiOperation({ operationId }): ${anonymous.join(', ')}`);
  return document;
}
