import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = process.env.ADMIN_QA_URL ?? 'http://127.0.0.1:4318';
const evidence = process.env.ADMIN_QA_OUTPUT ?? '/tmp/futhub-editorial-qa';
await mkdir(evidence, { recursive: true });
const portrait = await readFile(
  new URL('../../api/media/assets/card/default.png', import.meta.url),
);
const collection = {
  id: 'edition-qa',
  slug: 'fundadores',
  name: 'Fundadores',
  emoji: 'FH',
  imageUrl: null,
  primaryColor: '#405331',
  secondaryColor: '#eff6d4',
  contractsBlocked: false,
  overlayUrl: null,
  bannerUrl: null,
};
const team = {
  id: 'team-qa',
  slug: 'futhub-fc',
  name: 'FutHub FC',
  emoji: 'FH',
  imageUrl: null,
  color: '#314534',
  colors: ['#314534'],
};
const cards = ['Rafael Costa', 'Gabriel Santos', 'Lucas Oliveira', 'André Silva'].map(
  (name, index) => ({
    id: `card-${index}`,
    slug: `card-${index}`,
    name,
    overall: 94 - index * 3,
    imageUrl: '/qa-portrait.png',
    team,
    collection,
    position: ['CA', 'MC', 'ZAG', 'PD'][index],
    secondaryPositions: [],
    contractsBlocked: false,
    attack: 91,
    defense: 73,
    creation: 85,
    pace: 88,
    passing: 87,
    control: 90,
    marking: 68,
    dribbling: 90,
    finishing: 93,
  }),
);
const pack = {
  id: 'pack-qa',
  name: 'Edição de estreia',
  imageUrl: null,
  color: '#405331',
  emoji: 'FH',
  cardsAmount: 3,
  price: 2500,
  canBuy: true,
  limitPerUser: 2,
  presentation: null,
  config: {
    id: 'config-qa',
    name: null,
    minOverall: 70,
    maxOverall: 99,
    onlyPositions: [],
    excludedPositions: [],
    onlyCollectionIds: [],
    excludedCollectionIds: [],
    onlyCardIds: [],
    excludedCardIds: [],
    onlyTeamIds: [],
    excludedTeamIds: [],
  },
};
const lucro = {
  cooldownSeconds: 3600,
  rewards: [
    { id: 'reward-qa', value: 500, weight: 1, messages: { pt: 'Gol!', en: 'Goal!', es: 'Gol!' } },
  ],
  embed: { title: 'Lucro', description: '{reward} moedas', color: '#d1ef70', footer: 'FutHub' },
};
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const errors = [];
const measurements = [];
let mode = 'ready';
let authorized = true;
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/qa-portrait.png', (route) =>
  route.fulfill({ contentType: 'image/png', body: portrait }),
);
await page.route('**/v1/admin/**', async (route) => {
  const request = route.request();
  assert.equal(request.method(), 'GET', 'Browser QA must not write to real API');
  const url = new URL(request.url());
  requests.push(`${url.pathname}${url.search}`);
  const json = (data, status = 200) => route.fulfill({ status, json: data });
  if (url.pathname === '/v1/admin/session') return json({}, authorized ? 200 : 401);
  if (url.pathname.startsWith('/v1/admin/cards')) {
    if (mode === 'error') return json({ message: 'QA unavailable' }, 503);
    if (mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 800));
    const items =
      mode === 'empty'
        ? []
        : cards.filter(
            (card) =>
              !url.searchParams.get('query') ||
              card.name.toLowerCase().includes(url.searchParams.get('query').toLowerCase()),
          );
    if (url.pathname.endsWith('/catalog'))
      return json({
        collections: mode === 'empty' ? [] : [collection],
        teams: mode === 'empty' ? [] : [team],
      });
    if (url.pathname.includes('suggestions')) return json([]);
    if (url.pathname.endsWith('/collections'))
      return json({ items: mode === 'empty' ? [] : [collection], total: 1, page: 1, pageSize: 12 });
    if (url.pathname.endsWith('/teams'))
      return json({ items: mode === 'empty' ? [] : [team], total: 1, page: 1, pageSize: 12 });
    return json({ items, total: items.length, page: 1, pageSize: 24 });
  }
  if (url.pathname === '/v1/admin/packs') return json([pack]);
  if (url.pathname.endsWith('/lucro/schema'))
    return json({
      description: 'QA',
      variables: [],
      properties: Object.fromEntries(
        ['title', 'description', 'color', 'footer'].map((key) => [
          key,
          { maxLength: 2000, examples: [] },
        ]),
      ),
    });
  if (url.pathname.endsWith('/lucro')) return json(lucro);
  if (url.pathname.endsWith('/sessions/config')) return json(null);
  if (url.pathname.endsWith('/capabilities')) return json({ webSearch: false });
  return json([]);
});

async function capture(name, width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')]
      .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
      .map((node) => ({
        tag: node.tagName,
        class: node.className,
        right: node.getBoundingClientRect().right,
      }))
      .slice(0, 20),
  }));
  measurements.push({ name, ...geometry });
  if (name === 'packs') {
    const clippedActions = await page.locator('.pack-tile').evaluateAll((tiles) =>
      tiles.some((tile) => {
        const action = tile.querySelector('.collection-tile-manage');
        return action && action.getBoundingClientRect().right > tile.getBoundingClientRect().right;
      }),
    );
    assert.equal(clippedActions, false, `Pack actions clipped at ${width}`);
  }
  await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true });
  if (geometry.scrollWidth > width + 1)
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter(
            (node) =>
              node.scrollWidth > node.clientWidth + 1 &&
              getComputedStyle(node).overflowX === 'visible',
          )
          .map((node) => ({
            class: node.className,
            width: node.clientWidth,
            scroll: node.scrollWidth,
            before: getComputedStyle(node, '::before').content,
            after: getComputedStyle(node, '::after').content,
          })),
      ),
    );
  assert.ok(
    geometry.scrollWidth <= width + 1,
    `${name} overflows at ${width}: ${JSON.stringify(geometry)}`,
  );
}

try {
  await page.goto(`${origin}/`);
  await expect(page).toHaveURL(`${origin}/app`);
  await expect(page.locator('.album-athlete-caption h2')).toHaveText('Rafael Costa');
  await expect(page.locator('.album-portrait')).toBeVisible();
  await page.locator('.album-portrait').evaluate((image) => image.decode());
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  for (const width of [1280, 768, 375]) await capture('album', width);
  await page.getByRole('button', { name: /Gabriel Santos/ }).click();
  await expect(page.locator('.album-athlete-caption h2')).toHaveText('Gabriel Santos');
  await expect(page.getByRole('button', { name: /Gabriel Santos/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await capture('selected', 375);
  await page.getByRole('searchbox').fill('zzzz');
  await expect(page.getByRole('status')).toContainText('Nenhum card recente');
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.locator('.album-recent-player')).toHaveCount(4);
  await page.getByRole('searchbox').fill('Lucas');
  await expect(page.locator('.album-recent-player')).toHaveCount(1);
  await page.locator('.album-recent-player').click();
  await expect(page.getByRole('searchbox', { name: 'Buscar jogador', exact: true })).toHaveValue(
    'Lucas Oliveira',
  );
  await expect(page.locator('.player-vault-gallery .player-card')).toHaveCount(1);
  await expect(
    page
      .getByRole('navigation', { name: 'Capítulos do FutHub' })
      .getByRole('link', { name: /Acervo/ }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`${origin}/app`);
  await page.locator('.album-collection-list a').first().click();
  await expect(page.locator('.player-vault-gallery .player-card')).toHaveCount(4);
  assert.ok(requests.some((request) => request.includes('collectionId=edition-qa')));
  await expect(page.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  const routes = [
    ['cards', '/app/gerenciar/cards'],
    ['vault', '/app/gerenciar/jogadores'],
    ['collections', '/app/gerenciar/colecoes'],
    ['teams', '/app/gerenciar/times'],
    ['packs', '/app/gerenciar/packs'],
    ['commands', '/app/comandos'],
    ['economy', '/app/comandos/lucro'],
    ['assistant', '/app/assistente'],
    ['studio', '/app/studio'],
    ['pack-studio', '/app/studio/packs'],
  ];
  for (const [name, path] of routes) {
    await page.goto(`${origin}${path}`);
    await expect(page.locator('#admin-content h1')).toBeVisible();
    if (name === 'studio')
      await expect(page.locator('.studio-stage .studio-card-render')).toHaveAttribute(
        'data-render-state',
        /3d|fallback/,
        { timeout: 60000 },
      );
    if (name === 'pack-studio')
      await expect(page.locator('main [data-render-status]')).toHaveAttribute(
        'data-render-status',
        /ready|fallback/,
        { timeout: 60000 },
      );
    for (const width of [1280, 768, 375]) await capture(name, width);
  }
  await page.goto(`${origin}/app/gerenciar/cards`);
  await page.getByRole('button', { name: 'Novo card', exact: true }).click();
  await expect(page.getByRole('dialog').filter({ visible: true })).toBeVisible();
  await capture('card-dialog', 375);
  await page.keyboard.press('Escape');
  await page.goto(`${origin}/app/gerenciar/packs`);
  await page.getByRole('button', { name: 'Gerenciar Edição de estreia' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('pack-dialog', 375);
  await page.keyboard.press('Escape');

  mode = 'error';
  await page.goto(`${origin}/app`);
  await expect(page.getByRole('alert')).toContainText('O acervo não respondeu');
  await capture('error', 1280);
  mode = 'ready';
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.album-athlete-caption h2')).toHaveText('Rafael Costa');
  mode = 'empty';
  await page.reload();
  await expect(page.getByRole('link', { name: /Criar primeiro card/ })).toBeVisible();
  await capture('empty', 375);
  mode = 'loading';
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Preparando o acervo…');
  await page.screenshot({ path: `${evidence}/loading.png` });
  await expect(page.locator('.album-athlete-caption h2')).toHaveText('Rafael Costa');
  mode = 'ready';
  await page.getByRole('button', { name: 'Ativar modo claro' }).click();
  await expect(page.locator('.album-lineup button[aria-pressed="true"]')).toHaveCSS(
    'background-color',
    'rgb(225, 228, 215)',
  );
  const mutedContrast = await page.locator('.album-search > span').evaluate((label) => {
    const luminance = (color) => {
      const channels = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const text = luminance(getComputedStyle(label).color);
    const selected = document.querySelector('.album-lineup button[aria-pressed="true"]');
    if (!selected) throw new Error('Selected athlete missing');
    const canvas = luminance(getComputedStyle(selected).backgroundColor);
    return (Math.max(text, canvas) + 0.05) / (Math.min(text, canvas) + 0.05);
  });
  assert.ok(mutedContrast >= 4.5, `Light-theme auxiliary text contrast: ${mutedContrast}`);
  await capture('light', 1280);
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page.locator('.album-athlete').evaluate((node) => getComputedStyle(node).animationName),
    'none',
  );
  await page.goto(`${origin}/app`);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#admin-content')).toBeFocused();
  authorized = false;
  await page.reload();
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
  await capture('login', 375);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ passed: true, evidence, measurements, pageErrors: errors }, null, 2),
  );
} finally {
  await writeFile(
    `${evidence}/results.json`,
    JSON.stringify({ measurements, pageErrors: errors }, null, 2),
  );
  await browser.close();
}
