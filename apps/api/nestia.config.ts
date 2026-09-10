import type { INestiaConfig } from '@nestia/sdk';

export const swaggerConfig = {
  openapi: '3.0',
  info: {
    title: 'FutHub API',
    version: '1.0',
    description: 'API do FutHub para jogo, automações Discord e administração.',
  },
  servers: [],
  tags: [
    { name: 'Administração / Cards', description: 'Catálogo, coleções, times e imagens de cards.' },
    { name: 'Administração / Lucro', description: 'Configuração do comando de lucro.' },
    { name: 'Administração / Packs', description: 'Gerenciamento de packs e imagens.' },
    { name: 'Administração / Sessão', description: 'Sessão autenticada da área administrativa.' },
    { name: 'Comandos', description: 'Comandos executados por jogadores.' },
    { name: 'Liga', description: 'Fila ranqueada, classificação e partidas.' },
    { name: 'Mercado de cards', description: 'Compra e venda de cards de jogadores.' },
    { name: 'Missões', description: 'Missões disponíveis para jogador.' },
    { name: 'Packs', description: 'Compra e abertura de packs.' },
    { name: 'Saúde', description: 'Estado do serviço.' },
  ],
  security: {
    bearer: { type: 'http', scheme: 'bearer' },
  },
  beautify: true,
} satisfies Omit<INestiaConfig.ISwaggerConfig, 'output'>;

export default {
  input: 'src/**/*.controller.ts',
  swagger: { ...swaggerConfig, output: 'openapi.json' },
} satisfies INestiaConfig;
