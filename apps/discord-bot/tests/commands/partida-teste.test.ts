import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import PartidaTesteCommand from '../../src/commands/partida-teste.js';
import { mockApi } from '../support/api.js';

PartidaTesteCommand.frameDelayMs = 0;

const lineup = (prefix: string) =>
  ['GOL', 'LD', 'LE', 'ZAG', 'ZAG', 'VOL', 'MC', 'MA', 'PD', 'PE', 'CA'].map((position, index) => ({
    name: `${prefix} ${index + 1}`,
    position,
  }));

const match = {
  seed: 1234,
  home: {
    name: 'slipher-tester',
    avatarUrl: null,
    cpu: false,
    tactic: 'offensive',
    rating: 82,
    lineup: lineup('Titular'),
  },
  away: {
    name: 'FutHub CPU',
    avatarUrl: null,
    cpu: true,
    tactic: 'balanced',
    rating: 81,
    lineup: lineup('Rival'),
  },
  homeGoals: 1,
  awayGoals: 0,
  events: [
    { minute: 0, type: 'kickoff', description: 'A partida começou.', homeGoals: 0, awayGoals: 0 },
    {
      minute: 23,
      type: 'yellow_card',
      description: 'Cartão amarelo para Rival 4.',
      homeGoals: 0,
      awayGoals: 0,
    },
    {
      minute: 67,
      type: 'goal',
      description: 'Gol de Titular 11, com assistência de Titular 9.',
      homeGoals: 1,
      awayGoals: 0,
    },
    { minute: 90, type: 'fulltime', description: 'Fim de partida.', homeGoals: 1, awayGoals: 0 },
  ],
};

test('narra a partida de teste lance a lance até o fim de jogo', async () => {
  const api = mockApi(match);
  await using bot = await createMockBot({ commands: [PartidaTesteCommand] });

  const result = await bot.slash(PartidaTesteCommand, { options: { seed: 1234 } });

  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/matches/test',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
        opponentId: null,
        seed: 1234,
      },
    },
  ]);
  const first = JSON.stringify(result.messages[0]);
  assert.match(first, /AO VIVO · 0'/);
  assert.match(first, /slipher-tester 0 × 0 FutHub CPU/);
  assert.doesNotMatch(first, /Cartão amarelo/);

  assert.equal(result.edits.length, 3);
  const last = JSON.stringify(result.edits.at(-1));
  assert.match(last, /FIM DE JOGO · Vitória/);
  assert.match(last, /Gol de Titular 11/);
  assert.match(last, /CA Rival 11/);
  assert.match(last, /seed 1234/);
});

test('mostra a mensagem da API quando a escalação está incompleta', async () => {
  mockApi(
    {
      message:
        'Complete a escalação com 11 titulares em posições compatíveis antes de buscar uma partida.',
    },
    400,
  );
  await using bot = await createMockBot({ commands: [PartidaTesteCommand] });

  const result = await bot.slash(PartidaTesteCommand);

  assert.equal(
    result.content,
    'Complete a escalação com 11 titulares em posições compatíveis antes de buscar uma partida.',
  );
  assert.deepEqual(result.edits, []);
});
