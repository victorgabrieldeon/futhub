import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Controller, NotFoundException, Param, UseGuards } from '@nestjs/common';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type {
  CommandContextSchema,
  CommandContractResponse,
  CommandDataSchema,
  CommandUtility,
} from './lucro.dto.js';

const lucroData: CommandDataSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Embed do comando /lucro',
  description: 'Configuração da embed enviada quando o usuário resgata lucro.',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Título exibido no topo da embed.',
      minLength: 1,
      maxLength: 256,
      examples: ['Lucro resgatado'],
    },
    description: {
      type: 'string',
      description:
        'Descrição Markdown. Aceita {message}, {reward}, {balance}, {xp}, {level} e {availableAt}.',
      minLength: 1,
      maxLength: 4096,
      examples: [
        '{message}\n\n**+{reward} moedas**\nSaldo: **{balance}**\nXP: **+{xp}** · Nível: **{level}**\nPróximo lucro: {availableAt}',
      ],
    },
    color: {
      type: 'string',
      description: 'Cor hexadecimal da borda da embed.',
      pattern: '^#[0-9A-Fa-f]{6}$',
      examples: ['#22c55e'],
    },
    footer: {
      type: 'string',
      description: 'Texto opcional no rodapé da embed.',
      maxLength: 2048,
      examples: ['FutHub'],
    },
  },
  required: ['title', 'description', 'color', 'footer'],
  additionalProperties: false,
  examples: [
    {
      title: 'Lucro resgatado',
      description:
        '{message}\n\n**+{reward} moedas**\nSaldo: **{balance}**\nXP: **+{xp}** · Nível: **{level}**\nPróximo lucro: {availableAt}',
      color: '#22c55e',
      footer: 'FutHub',
    },
  ],
  variables: [
    { token: '{message}', description: 'Mensagem da faixa sorteada.', example: 'Lucro raro: +500' },
    { token: '{reward}', description: 'Quantidade de moedas recebida.', example: '500' },
    { token: '{balance}', description: 'Saldo após o resgate.', example: '4.250' },
    { token: '{xp}', description: 'XP recebida.', example: '10' },
    { token: '{level}', description: 'Nível atual.', example: '12' },
    {
      token: '{availableAt}',
      description: 'Quando /lucro estará disponível.',
      example: 'amanhã às 12:00',
    },
  ],
};

const userContext: CommandContextSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Contexto do usuário',
  description: 'Dados disponíveis do usuário que executou o comando.',
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nome atual no Discord.', example: 'Victor' },
    avatarUrl: {
      type: 'string',
      description: 'URL do avatar do Discord.',
      format: 'uri',
      example: 'https://cdn.discordapp.com/avatars/123/avatar.png',
    },
    balance: { type: 'integer', description: 'Saldo atual em moedas.', example: '4250' },
    xp: { type: 'integer', description: 'XP acumulada.', example: '250' },
    level: { type: 'integer', description: 'Nível atual.', example: '12' },
    language: { type: 'string', description: 'Idioma preferido.', example: 'pt-BR' },
    booster: { type: 'boolean', description: 'Indica assinante booster.', example: 'false' },
  },
  required: ['name', 'balance', 'xp', 'level', 'language', 'booster'],
  additionalProperties: false,
};

const utilities: CommandUtility[] = [
  {
    name: 'formatNumber',
    signature: 'formatNumber(value, locale)',
    description: 'Formata inteiro ou decimal no idioma do usuário.',
    example: "formatNumber(4250, 'pt-BR') = '4.250'",
  },
  {
    name: 'formatDateTime',
    signature: 'formatDateTime(value, locale)',
    description: 'Formata data e hora no idioma do usuário.',
    example: "formatDateTime(availableAt, 'pt-BR') = 'amanhã às 12:00'",
  },
  {
    name: 'formatDuration',
    signature: 'formatDuration(seconds)',
    description: 'Converte segundos em duração legível.',
    example: "formatDuration(600) = '10 min'",
  },
  {
    name: 'bold',
    signature: 'bold(text)',
    description: 'Aplica negrito Markdown compatível com Discord.',
    example: "bold('500 moedas') = '**500 moedas**'",
  },
];

const commandContracts: Readonly<Record<string, CommandContractResponse>> = {
  lucro: { data: lucroData, contexto: userContext, utilities },
};

@Controller('v1/commands')
@UseGuards(InternalAuthGuard)
export class CommandSchemaController {
  @TypedRoute.Get(':command/schema')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getCommandSchema';
    route.security = [{ bearer: [] }];
  })
  get(@Param('command') command: string): CommandContractResponse {
    const contract = commandContracts[command];
    if (!contract) throw new NotFoundException(`Schema for /${command} was not found.`);
    return contract;
  }
}
