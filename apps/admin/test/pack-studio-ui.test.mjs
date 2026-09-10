import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// API fixtures prevent reads and writes to real packs.
const browser = await chromium.launch({
  executablePath: chromium.executablePath(),
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.route('**/v1/admin/**', (route) => {
  assert.equal(route.request().method(), 'GET', 'QA must not write to API');
  return route.fulfill({ json: route.request().url().includes('/session') ? {} : [] });
});
const ready = () => expect(page.locator('main [data-render-status]')).toHaveAttribute('data-render-status', 'ready', { timeout: 60000 });
const pixels = () => page.locator('main canvas.lower-canvas').evaluate((canvas) => canvas.toDataURL());
try {
  await page.goto(process.env.PACK_STUDIO_URL ?? 'http://127.0.0.1:4173/app/studio/packs');
  await ready();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await expect(page.locator('.pack-studio-layers .pack-studio-direction-list')).toBeVisible();
  await expect(page.locator('.pack-studio-inspector .pack-studio-direction-list')).toHaveCount(0);
  for (const section of ['Texto', 'Cores', 'Acabamento']) {
    await expect(page.getByRole('group', { name: section, exact: true })).toBeVisible();
  }
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Rascunho local · não publicado');
  const beforeFrontImage = await pixels();
  await page.getByRole('button', { name: 'Adicionar foto frontal', exact: true }).click();
  const frontImageDialog = page.getByRole('dialog', { name: 'Ajustar foto frontal', exact: true });
  await expect(frontImageDialog).toBeVisible();
  await frontImageDialog.locator('input[type="file"]').setInputFiles({
    name: 'frente.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgAH/2o1qSgAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(frontImageDialog.getByRole('button', { name: 'Aplicar no frente do pack', exact: true })).toBeEnabled();
  await frontImageDialog.getByRole('button', { name: 'Aplicar no frente do pack', exact: true }).click();
  await expect(frontImageDialog).toHaveCount(0);
  await ready();
  await expect(page.getByRole('button', { name: 'Ajustar foto frontal', exact: true })).toBeVisible();
  assert.notEqual(await pixels(), beforeFrontImage, 'Front image must change rendered pack art');
  await page.screenshot({ path: '/tmp/pack-studio-front-image.png', fullPage: true });
  const library = await page.locator('.pack-studio-layers').boundingBox();
  const stage = await page.locator('.pack-studio-canvas-region').boundingBox();
  const inspector = await page.locator('.pack-studio-inspector').boundingBox();
  assert.ok(library.x + library.width <= stage.x + 1);
  assert.ok(stage.x + stage.width <= inspector.x + 1);
  assert.ok(stage.width > library.width && stage.width > inspector.width, 'Canvas must be focal desktop pane');
  await expect(page.locator('.pack-studio-preset-image img')).toHaveCount(4);
  assert.equal(await page.locator('.pack-studio-preset-image img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth === 600)), true);
  await page.getByRole('tab', { name: 'Pack', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Pack QA');
  await page.getByLabel('Cartas', { exact: true }).fill('4');
  await page.getByLabel('Preço', { exact: true }).fill('1234');
  await page.getByLabel('Limite', { exact: true }).fill('7');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.getByRole('button', { name: 'Remover foto', exact: true }).click();
  const renders = new Set();
  for (const preset of ['Padrão', 'Neon', 'Gold', 'Ice']) {
    await page.getByRole('button', { name: `Aplicar preset ${preset}`, exact: true }).click();
    await ready();
    await expect(page.getByRole('button', { name: `Aplicar preset ${preset}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    renders.add(await pixels());
    await page.screenshot({ path: `/tmp/pack-studio-preset-${preset}.png`, fullPage: true });
  }
  assert.equal(renders.size, 4, 'Presets must produce different artwork');
  const finishes = new Set();
  for (const effect of ['foil', 'holographic', 'chrome']) {
    await page.getByRole('combobox', { name: 'Efeito', exact: true }).selectOption(effect);
    await ready();
    finishes.add(await pixels());
    await page.screenshot({ path: `/tmp/pack-studio-finish-${effect}.png`, fullPage: true });
  }
  assert.equal(finishes.size, 3, 'Finishes must differ with identical colors and text');
  const beforeTextColor = await pixels();
  await page.getByLabel('Cor do texto', { exact: true }).fill('#ff3344');
  await ready();
  assert.notEqual(await pixels(), beforeTextColor, 'Text color must invalidate rendered art');
  await expect(page.locator('.pack-studio-direction-list [aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Aplicar preset Ice', exact: true }).click();
  await ready();
  await expect(page.getByLabel('Cor do texto', { exact: true })).toHaveValue('#ffffff');
  await page.getByRole('tab', { name: 'Pack', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Pack QA');
  await expect(page.getByLabel('Cartas', { exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Preço', { exact: true })).toHaveValue('1234');
  await expect(page.getByLabel('Limite', { exact: true })).toHaveValue('7');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const canvas = await page.locator('main canvas.lower-canvas').elementHandle();
  await page.getByRole('button', { name: 'Subtítulo', exact: true }).click();
  await page.getByLabel('Subtítulo', { exact: true }).fill('EDIÇÃO ESPECIAL');
  await ready();
  await expect(page.locator('.pack-studio-layer[aria-pressed="true"]')).toContainText('EDIÇÃO ESPECIAL');
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['Edição', 'Loja', 'Miniatura']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await ready();
      assert.equal(await canvas.evaluate((node) => node === document.querySelector('main canvas.lower-canvas')), true, 'Context must preserve canvas identity');
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(layout.scroll <= layout.width, `Horizontal overflow ${mode} ${width}: ${JSON.stringify(layout)}`);
      if (mode === 'Miniatura') {
        const box = await page.locator('main .canvas-container').boundingBox();
        assert.equal(Math.round(box.width), 96);
        assert.equal(Math.round(box.height), 128);
      }
      if (mode !== 'Edição') {
        await expect(page.locator('.pack-studio-preview-details')).toContainText('Pack QA');
        await expect(page.locator('.pack-studio-preview-details')).toContainText('1.234 moedas');
      }
      await page.screenshot({ path: `/tmp/pack-studio-${width}-${mode}.png`, fullPage: true });
    }
    for (const tab of ['Pack', 'Conteúdo', 'Design']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/pack-studio-${width}-panel-${tab}.png`, fullPage: true });
    }
  }
  await page.getByRole('tab', { name: 'Pack', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('PackSemEspaços'.repeat(8));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Long pack name must reflow');
  await page.getByLabel('Nome', { exact: true }).fill('Pack QA');
  await page.setViewportSize({ width: 1280, height: 1000 });
  let projectPath;
  for (const format of ['PNG', 'WEBP', 'Projeto .futhub']) {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await page.getByRole('radio', { name: new RegExp(format.replace('.', '\\.')) }).check();
    if (format !== 'Projeto .futhub') {
      await page.getByRole('radio', { name: format === 'PNG' ? /^2×/ : /^1×/ }).check();
    }
    await page.screenshot({ path: `/tmp/pack-studio-export-${format.split(' ')[0]}.png`, fullPage: true });
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar arquivo', exact: true }).click();
    const download = await pending;
    const path = `/tmp/pack-studio-qa-${download.suggestedFilename()}`;
    await download.saveAs(path);
    if (format === 'Projeto .futhub') {
      projectPath = path;
      const project = JSON.parse(await readFile(path, 'utf8'));
      assert.ok(JSON.stringify(project).includes('Pack QA'));
    } else {
      const bytes = await readFile(path);
      const image = await page.evaluate(async ({ base64, format }) => {
        const response = await fetch(`data:image/${format.toLowerCase()};base64,${base64}`);
        const image = await createImageBitmap(await response.blob());
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return { width: image.width, height: image.height, alpha: context.getImageData(0, 0, 1, 1).data[3] };
      }, { base64: bytes.toString('base64'), format });
      const scale = format === 'PNG' ? 2 : 1;
      assert.deepEqual(image, { width: 600 * scale, height: 800 * scale, alpha: 0 });
    }
  }
  await page.getByRole('button', { name: 'Testar abertura', exact: true }).click();
  await expect(page.locator('.pack-studio-experience [data-render-status]')).toHaveAttribute('data-render-status', 'ready');
  await page.getByRole('button', { name: /Puxar lacre/ }).click();
  await expect(page.getByRole('heading', { name: '4 cartas reveladas' })).toBeVisible();
  await page.screenshot({ path: '/tmp/pack-studio-opening.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar preview', exact: true }).click();
  await page.getByRole('button', { name: 'Edição', exact: true }).click();
  await page.getByRole('button', { name: 'Loja', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Loja', exact: true })).toHaveAttribute('aria-pressed', 'true');
  assert.ok(projectPath);
  await page.locator('input[type="file"]').setInputFiles(projectPath);
  await expect(page.locator('.pack-studio-notice')).toContainText('importado');
  await ready();
  let published;
  let failPublication = false;
  const writes = [];
  await page.route(/\/v1\/admin\/packs(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: published ? [published] : [] });
    writes.push({ method: request.method(), url: request.url() });
    if (failPublication) return route.fulfill({ status: 400, json: { message: 'Publicação recusada no teste' } });
    if (!request.url().endsWith('/image')) {
      const input = request.postDataJSON();
      published = { ...input, id: 'qa-pack', config: { ...input.config, id: 'qa-config' } };
    }
    assert.ok(published);
    return route.fulfill({ json: published });
  });
  await page.getByRole('button', { name: 'Salvar e publicar', exact: true }).click();
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Versão publicada', { timeout: 30000 });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].method, 'POST');
  assert.ok(writes[1].url.endsWith('/qa-pack/image'));
  assert.equal(published.name, 'Pack QA');
  assert.equal(published.presentation.kicker, 'EDIÇÃO ESPECIAL');
  await page.reload();
  await ready();
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Versão publicada');
  await page.getByRole('tab', { name: 'Pack', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Pack alterado');
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Alterações não publicadas');
  failPublication = true;
  await page.getByRole('button', { name: 'Salvar e publicar', exact: true }).click();
  await expect(page.locator('.pack-studio-notice')).toContainText('Publicação recusada no teste');
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Alterações não publicadas');
  failPublication = false;
  await page.getByRole('button', { name: 'Salvar e publicar', exact: true }).click();
  await expect(page.locator('.pack-studio-save-state')).toHaveText('Versão publicada', { timeout: 30000 });
  assert.equal(published.name, 'Pack alterado');
  await page.screenshot({ path: '/tmp/pack-studio-published.png', fullPage: true });
  const expectedFailure = errors.findIndex((error) => error.includes('400 (Bad Request)'));
  if (expectedFailure !== -1) errors.splice(expectedFailure, 1);
  assert.deepEqual(errors, []);
  console.log('pack-studio-ui: ok (layout, 4 presets, text/color editing, data preservation, 3 widths × contexts/panels, long name, downloads/import, opening, keyboard, mocked publish/reload/error/retry, no unexpected browser errors)');
} finally {
  await browser.close();
}
