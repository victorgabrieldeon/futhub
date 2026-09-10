import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

const origin = process.env.ADMIN_QA_URL ?? 'http://127.0.0.1:4318';
const evidence = await mkdtemp(join(tmpdir(), 'futhub-lint-semantics-'));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
const collection = {
  id: 'collection',
  name: 'Test',
  slug: 'test',
  emoji: 'FH',
  primaryColor: '#405331',
  secondaryColor: '#eff6d4',
  contractsBlocked: false,
};
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /unique.*key|same key/.test(message.text()))
    errors.push(message.text());
});
// Given isolated HTTP fixtures; the browser cannot write to the real API.
await page.route('**/v1/admin/**', (route) => {
  assert.equal(route.request().method(), 'GET');
  const path = new URL(route.request().url()).pathname;
  let json = [];
  if (path.endsWith('/session')) json = {};
  if (path.endsWith('/catalog'))
    json = {
      collections: [collection],
      teams: [],
    };
  if (/\/(cards|collections|teams)$/.test(path))
    json = { items: [], total: 0, page: 1, pageSize: 24 };
  if (path.endsWith('/collections'))
    json = { items: [collection], total: 1, page: 1, pageSize: 24 };
  if (path.endsWith('/lucro'))
    json = {
      cooldownSeconds: 300,
      rewards: [
        { id: 'reward', value: 500, weight: 1, messages: { pt: 'Gol!', en: 'Goal!', es: 'Gol!' } },
      ],
      embed: { title: 'Lucro', description: '{reward}', color: '#d1ef70', footer: 'FutHub' },
    };
  if (path.endsWith('/lucro/schema'))
    json = {
      description: 'QA',
      variables: [],
      properties: Object.fromEntries(
        ['title', 'description', 'color', 'footer'].map((key) => [
          key,
          { maxLength: 2000, examples: [] },
        ]),
      ),
    };
  return route.fulfill({ json });
});
try {
  // When opening the command palette by keyboard, its search receives focus.
  await page.goto(`${origin}/app/comandos`);
  await expect(page.locator('#command-palette-input')).toBeAttached();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-palette-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.command-palette')).not.toBeVisible();

  // When opening the collection catalog, typing and Escape retain their behavior.
  await page.goto(`${origin}/app/gerenciar/colecoes`);
  await page.locator('.catalog-view-all').click();
  const catalog = page.locator('#catalog-browser-dialog');
  const search = catalog.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('test');
  await expect(search).toHaveValue('test');
  await page.keyboard.press('Escape');
  await expect(catalog).not.toBeVisible();

  // When viewing rewards, native meters expose the same values as the visual bars.
  await page.goto(`${origin}/app/comandos/lucro`);
  await expect(page.locator('output.cooldown-warning')).toBeVisible();
  await page.getByRole('tab', { name: 'Lucros', exact: true }).click();
  await expect(page.getByRole('meter')).toHaveCount(2);
  for (const meter of await page.getByRole('meter').all()) {
    await expect(meter).toHaveAttribute('value', '100');
    await expect(meter).toHaveAttribute('max', '100');
  }
  await expect(page.locator('.reward-probability-track i')).toHaveAttribute(
    'style',
    'width: 100%;',
  );
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: join(evidence, `rewards-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(`lint-semantics-ui: ok; screenshots: ${evidence}`);
} finally {
  await browser.close();
}
