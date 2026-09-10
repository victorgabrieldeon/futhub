import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Given a local login page: no credentials or writes reach the real API.
const browser = await chromium.launch({
  executablePath: chromium.executablePath(),
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const evidence = await mkdtemp(join(tmpdir(), 'login-stadium-'));
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/v1/admin/**', (route) => route.fulfill({ status: 401, json: {} }));
const url = process.env.LOGIN_URL ?? 'http://localhost:4317/login';
try {
  // When the viewport changes, Then the stadium and credential field remain visible.
  await page.goto(url);
  await expect(page.locator('.login-stadium')).toHaveAttribute('data-render-status', 'ready');
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.login-stadium canvas')).toBeVisible();
    await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const capture = await page.locator('.login-stadium').screenshot();
    const turfPixels = await page.evaluate(
      async (dataUrl) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let green = 0;
        for (let pixel = 0; pixel < data.length; pixel += 4) {
          if (data[pixel + 1] > data[pixel] * 1.15 && data[pixel + 1] > data[pixel + 2] * 1.1)
            green++;
        }
        return green;
      },
      `data:image/png;base64,${capture.toString('base64')}`,
    );
    assert.ok(
      turfPixels > 100,
      `Expected visible rendered turf at ${width}px, got ${turfPixels} green pixels`,
    );
    await page.screenshot({ path: join(evidence, `light-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await page.screenshot({ path: join(evidence, 'dark-reduced-motion.png'), fullPage: true });
  await page.getByLabel('API key', { exact: true }).focus();
  await expect(page.getByLabel('API key', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  assert.equal(
    await page
      .getByLabel('API key', { exact: true })
      .evaluate((input) => input.validity.valueMissing),
    true,
  );

  const contextLoss = await page
    .locator('.login-stadium canvas')
    .evaluateHandle((canvas) => canvas.getContext('webgl2').getExtension('WEBGL_lose_context'));
  await contextLoss.evaluate((extension) => extension.loseContext());
  await expect(page.locator('.login-stadium')).toHaveAttribute('data-render-status', 'fallback');
  await contextLoss.evaluate((extension) => extension.restoreContext());
  await expect(page.locator('.login-stadium')).toHaveAttribute('data-render-status', 'ready');
  await contextLoss.dispose();

  // Given no WebGL, When login mounts, Then fallback remains and login still works.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await page.reload();
  await expect(page.locator('.login-stadium')).toHaveAttribute('data-render-status', 'fallback');
  await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
  await expect(page.locator('.login-stadium__fallback')).toBeVisible();
  await page.getByLabel('API key', { exact: true }).fill('qa-invalid-key');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page.locator('.form-error')).toBeVisible();
  await page.getByLabel('API key', { exact: true }).fill('');
  await page.screenshot({ path: join(evidence, 'fallback.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', evidence, widths: [1440, 1280, 768, 375], errors }));
} finally {
  await browser.close();
}
