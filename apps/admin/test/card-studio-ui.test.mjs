import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { emptyDraft } from '../src/features/studio/studio-model.ts';

const key = 'futhub.admin.studio.session.v3';
const photo = await readFile(new URL('../../api/media/assets/card/default.png', import.meta.url));
const logo = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><path fill="#d9bc78" d="M8 8H72V50L40 76 8 50Z"/><text x="40" y="47" text-anchor="middle" font-size="28">F</text></svg>').toString('base64')}`;
const draft = {
  ...emptyDraft,
  name: 'RAFAEL COSTA',
  teamName: 'FUTEBOL CLUBE',
  collectionName: 'FUNDADORES',
  teamLogoUrl: '/qa-card-logo.svg',
  playerImageUrl: `data:image/png;base64,${photo.toString('base64')}`,
  photoFormat: 'png',
  photoIsStandard: true,
};
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/qa-card-logo.svg', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: Buffer.from(logo.split(',')[1], 'base64'),
  }),
);
await page.route('**/v1/admin/**', (route) => {
  assert.equal(route.request().method(), 'GET', 'QA must not write to API');
  const url = route.request().url();
  return route.fulfill({
    json: url.includes('/session')
      ? {}
      : url.includes('player-photo-suggestions')
        ? []
        : { items: [], total: 0, page: 1, pageSize: 12 },
  });
});
await page.addInitScript(
  ({ key, draft }) => {
    localStorage.setItem('futhub-theme', 'dark');
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          draft,
          selectedCardId: '',
          snapshots: [],
          favoriteIds: [],
          recentIds: [],
        }),
      );
  },
  { key, draft },
);
const render = page.locator('.studio-stage .studio-card-render');
const ready = () => expect(render).toHaveAttribute('data-render-state', '3d', { timeout: 60000 });
const pixels = () => render.locator('.studio-card-model').getAttribute('src');
const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).draft, key);
const range = async (name, value) => {
  await page.getByRole('slider', { name }).fill(String(value));
  await ready();
};
try {
  await page.goto(process.env.CARD_STUDIO_URL ?? 'http://127.0.0.1:4174/app/studio');
  await ready();
  assert.equal(
    await page.locator('.studio-workbench').evaluate((node) => getComputedStyle(node).backgroundColor),
    'rgb(17, 17, 17)',
    'Studio must follow dark theme',
  );
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  const frames = new Set();
  for (const name of [
    'Brasão',
    'Arena',
    'Ingresso',
    'Diamante',
    'Hexágono',
    'Coroa',
    'Asa',
    'Pavilhão',
  ]) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await ready();
    frames.add(await pixels());
    await render.screenshot({ path: `/tmp/card-studio-${name}.png` });
  }
  assert.equal(frames.size, 8, 'Each frame must produce distinct pixels');
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('button', { name: /^Asa/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Redo/ }).click();
  await expect(page.getByRole('button', { name: /^Pavilhão/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await ready();
  const before = await pixels();
  await range('Espessura da moldura', 12);
  await page.getByLabel(/Cor do metal/).fill('#a4c8ef');
  await page.getByRole('combobox', { name: 'Textura', exact: true }).selectOption('rays');
  await range('Intensidade da textura', 80);
  await range('Luz atrás da foto', 60);
  await range('Luminosidade da foto', 115);
  await range('Saturação da foto', 70);
  await range('Tamanho do nome', 85);
  await page.getByRole('combobox', { name: 'Tipografia do nome' }).selectOption('classic');
  await page.getByLabel('Texto da edição').fill('FUNDADORES 2026');
  await page.getByLabel('Mostrar placa do nome').uncheck();
  await page.getByLabel('Mostrar barras de atributos').uncheck();
  await ready();
  assert.notEqual(await pixels(), before, 'Design controls must change rendered pixels');
  await expect.poll(async () => (await stored()).design.edition).toBe('FUNDADORES 2026');
  const saved = (await stored()).design;
  assert.deepEqual(saved, {
    ...draft.design,
    frame: 'pavilion',
    frameWidth: 12,
    metalColor: '#a4c8ef',
    texture: 'rays',
    textureOpacity: 80,
    glow: 60,
    photoBrightness: 115,
    photoSaturation: 70,
    nameScale: 85,
    typography: 'classic',
    edition: 'FUNDADORES 2026',
    showNameplate: false,
    showStatBars: false,
  });
  await page.reload();
  await ready();
  assert.deepEqual((await stored()).design, saved);
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar somente o design' }).click();
  await ready();
  await expect.poll(async () => (await stored()).design).toEqual(draft.design);
  assert.equal((await stored()).name, draft.name, 'Design reset must preserve athlete');
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `/tmp/card-studio-${width}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Overflow at ${width}px`,
    );
    const canvas = await page.locator('.studio-stage .studio-canvas-shell').boundingBox();
    const art = await render.boundingBox();
    if (width === 1280) assert.ok(art.width >= 500, `Desktop card too small: ${art.width}px`);
    assert.ok(
      art.x >= canvas.x - 1 &&
        art.x + art.width <= canvas.x + canvas.width + 1 &&
        art.y >= canvas.y - 1 &&
        art.y + art.height <= canvas.y + canvas.height + 1,
      `Card clipped inside canvas at ${width}px: ${JSON.stringify({ art, canvas })}`,
    );
    const overlay = await render.locator('.studio-card-master').boundingBox();
    assert.ok(
      Math.abs(overlay.width - art.width) < 1 && Math.abs(overlay.height - art.height) < 1,
      `SVG guide overlay must match rendered artwork dimensions at ${width}: ${JSON.stringify({ overlay, art })}`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const mode of ['Discord', 'Mobile', 'Arte']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await ready();
    const art = await render.locator('.studio-card-model').boundingBox();
    const overlay = await render.locator('.studio-card-master').boundingBox();
    assert.ok(
      Math.abs(overlay.width - art.width) < 1 && Math.abs(overlay.height - art.height) < 1,
      `SVG guide overlay must match artwork in ${mode}: ${JSON.stringify({ overlay, art })}`,
    );
    await page.screenshot({ path: `/tmp/card-studio-mode-${mode}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Card', exact: true }).click();
  await ready();
  await page.getByRole('button', { name: 'Exportar card', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Exportar imagens' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Gerar EA FC Item', exact: true }).click();
  const download = await pending;
  await download.saveAs('/tmp/card-studio-export.png');
  const bytes = await readFile('/tmp/card-studio-export.png');
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 600);
  assert.equal(bytes.readUInt32BE(20), 800);
  const alpha = await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const image = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, 1, 1).data[3];
  }, bytes.toString('base64'));
  assert.equal(alpha, 0, 'External background must remain transparent');
  await page.getByRole('button', { name: 'Guias', exact: true }).click();
  await expect(render.locator('g[stroke-dasharray="8 7"]')).toBeVisible();
  assert.equal(
    await render
      .locator('g[stroke-dasharray="8 7"]')
      .evaluate((node) => getComputedStyle(node).opacity),
    '1',
  );
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl' || type === 'webgl2'
        ? null
        : Reflect.apply(original, this, [type, ...args]);
    };
  });
  await page.reload();
  await expect(render).toHaveAttribute('data-render-state', 'svg', { timeout: 60000 });
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  await page.getByRole('button', { name: /^Arena/ }).click();
  await expect(render).toHaveAttribute('data-render-state', 'svg', { timeout: 60000 });
  await render.screenshot({ path: '/tmp/card-studio-fallback.png' });
  assert.deepEqual(errors, []);
  console.log(
    'card-studio-ui: ok (8 frames, controls, undo/redo, persistence, reset, responsive, PNG alpha, guides, WebGL fallback)',
  );
} finally {
  await browser.close();
}
