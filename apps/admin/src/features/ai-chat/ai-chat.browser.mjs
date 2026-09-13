import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { checkImprovements } from './improvements.browser.mjs';

const origin = process.env.ADMIN_QA_URL ?? 'http://127.0.0.1:4317';
const evidence = process.env.ADMIN_QA_OUTPUT ?? '/tmp/admin-ai-chat-improvements-qa';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let state;
  let actionCalls = 0;
  let messageCalls = 0;
  let expire = false;
  let getFails = false;
  let getFailureStatus = 503;
  let connectFails = false;
  let messageFails = false;
  let loseMessageResponse = false;
  let listingUnavailable = false;
  let deleteCalls = 0;
  let authorized = true;
  const measurements = [];
  await page.route('**/v1/admin/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    const stream = () =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ type: 'state', state })}\n\ndata: {"type":"done"}\n\n`,
      });
    if (path === '/v1/admin/session')
      return authorized ? json({ authorized: true }) : json({ message: 'Não autorizado' }, 401);
    if (path.endsWith('/capabilities')) return json({ webSearch: false });
    if (path === '/v1/admin/ai/sessions/config') return json(null);
    if (path === '/v1/admin/ai/sessions') {
      assert.equal(req.postDataJSON().apiKey, 'qa-only-key');
      if (connectFails) return json({ message: 'Credencial recusada pelo provedor (QA)' }, 401);
      state = {
        id: 'qa-session',
        models: listingUnavailable ? [] : ['qa-model'],
        model: null,
        notice: listingUnavailable ? 'Descoberta de modelos não suportada (QA)' : null,
        messages: [],
        actions: [],
      };
      return json(state);
    }
    if (expire) return json({ message: 'Sessão expirada.' }, 404);
    if (req.method() === 'DELETE') {
      deleteCalls++;
      return route.fulfill({ status: 204 });
    }
    if (req.method() === 'GET')
      return getFails
        ? json({ message: 'Estado indisponível (QA)' }, getFailureStatus)
        : json(state);
    if (path.endsWith('/messages/stream')) {
      messageCalls++;
      assert.equal(req.postDataJSON().model, 'manual-model');
      if (messageFails) return json({ message: 'Provedor indisponível (QA)' }, 502);
      state.model = req.postDataJSON().model;
      for (const proposal of state.actions)
        if (proposal.status === 'pending') proposal.status = 'rejected';
      state.messages.push({
        id: `u-${messageCalls}`,
        role: 'user',
        content: req.postDataJSON().message,
      });
      state.messages.push({
        id: `a-${messageCalls}`,
        role: 'assistant',
        content: 'Revise os dados antes de criar. <script>alert(1)</script>',
      });
      state.actions.push({
        id: `proposal-${messageCalls}`,
        tool: 'create_team',
        arguments: JSON.stringify({
          name: 'Time QA',
          unknownField: 'x'.repeat(300),
          nested: { enabled: false, count: 0 },
        }),
        status: 'pending',
        result: null,
      });
      if (loseMessageResponse) return route.abort('failed');
      return stream();
    }
    actionCalls++;
    const proposal = state.actions.find((item) => path.endsWith(`/${item.id}/stream`));
    assert.ok(proposal);
    proposal.status = req.postDataJSON().approved ? 'succeeded' : 'rejected';
    proposal.result = 'Decisão registrada';
    return route.abort('failed');
  });
  await page.goto(`${origin}/app/assistente`);
  await page.getByLabel('Chave da API').fill('qa-only-key');
  await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
  await page.getByLabel('Modelo', { exact: true }).fill('manual-model');
  const prompt = page.getByLabel('Mensagem', { exact: true });
  await prompt.fill('Criar time');
  await prompt.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  assert.equal(messageCalls, 0);
  await prompt.press('Shift+Enter');
  assert.equal(messageCalls, 0);
  await prompt.press('Enter');
  await page.getByRole('button', { name: 'Confirmar criação' }).waitFor();
  assert.equal(await page.getByLabel('Modelo', { exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Ajustar proposta' }).count(), 1);
  assert.equal(await page.getByText('unknownField', { exact: true }).count(), 1);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${evidence}/review-${width}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const measured = await page.locator('.ai-chat-page').evaluate((root) => ({
      width: innerWidth,
      controls: [...root.querySelectorAll('button,input,select,textarea,summary')]
        .filter((item) => item.getClientRects().length)
        .map((item) => ({
          tag: item.tagName,
          height: item.getBoundingClientRect().height,
          width: item.getBoundingClientRect().width,
        })),
      overflow: [...root.querySelectorAll('*')]
        .filter(
          (item) =>
            item.getClientRects().length &&
            item.scrollWidth > item.clientWidth + 1 &&
            !['INPUT', 'SELECT', 'TEXTAREA'].includes(item.tagName),
        )
        .map((item) => item.className),
    }));
    assert.ok(measured.controls.every((item) => item.height >= 44 && item.width >= 44));
    assert.deepEqual(measured.overflow, []);
    await page.getByRole('log').focus();
    assert.equal(await page.getByRole('log').evaluate((el) => el === document.activeElement), true);
    assert.equal(
      await page.getByRole('log').evaluate((el) => getComputedStyle(el).outlineStyle),
      'solid',
    );
    const focus = await page.getByRole('log').evaluate((el) => ({
      active: el === document.activeElement,
      outlineStyle: getComputedStyle(el).outlineStyle,
      outlineWidth: getComputedStyle(el).outlineWidth,
    }));
    measurements.push({ ...measured, focus });
  }
  await page.getByRole('button', { name: 'Confirmar criação' }).click();
  await page.getByText('Criado', { exact: true }).waitFor();
  assert.equal(actionCalls, 1);
  assert.equal(await page.getByRole('button', { name: 'Confirmar criação' }).count(), 0);
  assert.equal(await page.locator('.ai-chat-page script').count(), 0);
  messageFails = true;
  await prompt.fill('Falha e nova tentativa');
  await prompt.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Provedor indisponível (QA)');
  assert.equal(await prompt.inputValue(), 'Falha e nova tentativa');
  messageFails = false;
  await prompt.press('Enter');
  await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
  await page.getByText('Rejeitado', { exact: true }).waitFor();
  assert.equal(actionCalls, 2);
  await prompt.fill('Ajuste inicial');
  await prompt.press('Enter');
  await page.getByRole('button', { name: 'Ajustar proposta' }).waitFor();
  await prompt.fill('Ajuste final');
  await prompt.press('Enter');
  await expect(page.getByText('Rejeitado', { exact: true })).toHaveCount(2);
  getFails = true;
  await page.getByRole('button', { name: 'Confirmar criação' }).click();
  await expect(page.getByRole('button', { name: 'Atualizar estado' })).toBeEnabled();
  assert.equal(await page.getByRole('button', { name: 'Confirmar criação' }).isDisabled(), true);
  assert.equal(await prompt.isDisabled(), true);
  assert.equal(actionCalls, 3);
  getFails = false;
  await page.getByRole('button', { name: 'Atualizar estado' }).click();
  await expect(page.getByText('Criado', { exact: true })).toHaveCount(2);
  assert.equal(actionCalls, 3);
  assert.equal(
    await page
      .evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))
      .then((v) => /qa-session|qa-only-key/.test(v)),
    false,
  );
  expire = true;
  await prompt.fill('Mais uma rodada');
  await prompt.press('Enter');
  await page.getByLabel('Chave da API').waitFor();
  assert.equal(await page.getByLabel('Chave da API').inputValue(), '');
  expire = false;
  connectFails = true;
  await page.getByLabel('Chave da API').fill('qa-only-key');
  await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Credencial recusada pelo provedor (QA)');
  assert.equal(await page.getByLabel('Chave da API').inputValue(), '');
  connectFails = false;
  listingUnavailable = true;
  await page.getByLabel('Chave da API').fill('qa-only-key');
  await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Descoberta' })).toHaveCount(1);
  await page.getByLabel('Modelo', { exact: true }).fill('manual-model');
  await page.getByRole('button', { name: 'Nova sessão', exact: true }).click();
  await page.getByLabel('Chave da API').waitFor();
  assert.equal(deleteCalls, 1);
  await page.getByLabel('Chave da API').fill('qa-only-key');
  await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar sessão' }).click();
  await page.getByLabel('Chave da API').waitFor();
  assert.equal(deleteCalls, 2);
  await page.getByLabel('Chave da API').fill('qa-only-key');
  await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
  await page.getByLabel('Modelo', { exact: true }).fill('manual-model');
  loseMessageResponse = true;
  const callsBeforeLoss = messageCalls;
  await prompt.fill('Resposta perdida após receber mensagem');
  await prompt.press('Enter');
  await expect(prompt).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Confirmar criação' })).toBeEnabled();
  assert.equal(messageCalls, callsBeforeLoss + 1);
  assert.equal(state.messages.filter((message) => message.role === 'user').length, 1);
  for (const status of [503, 409]) {
    getFails = true;
    getFailureStatus = status;
    const before = messageCalls;
    const content = `Recuperação manual após GET ${status}`;
    await prompt.fill(content);
    await prompt.press('Enter');
    await expect(page.getByRole('button', { name: 'Atualizar estado' })).toBeEnabled();
    await expect(prompt).toBeDisabled();
    await expect(prompt).toHaveValue(content);
    getFails = false;
    await page.getByRole('button', { name: 'Atualizar estado' }).click();
    await expect(prompt).toBeEnabled();
    await expect(prompt).toHaveValue('');
    await prompt.press('Enter');
    assert.equal(messageCalls, before + 1);
    assert.equal(
      state.messages.filter((message) => message.role === 'user' && message.content === content)
        .length,
      1,
    );
  }
  messageFails = true;
  getFails = true;
  const beforeRejectedMessage = messageCalls;
  await prompt.fill('Recuperação manual após GET 409');
  await prompt.press('Enter');
  await expect(page.getByRole('button', { name: 'Atualizar estado' })).toBeEnabled();
  getFails = false;
  await page.getByRole('button', { name: 'Atualizar estado' }).click();
  await expect(prompt).toBeEnabled();
  await expect(prompt).toHaveValue('Recuperação manual após GET 409');
  assert.equal(messageCalls, beforeRejectedMessage + 1);
  messageFails = false;
  loseMessageResponse = false;
  await page.reload();
  await expect(page.getByLabel('Chave da API')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salvar e conectar', exact: true })).toBeEnabled();
  assert.equal(await page.locator('.ai-message').count(), 0);
  assert.equal(await page.getByLabel('Modelo', { exact: true }).count(), 0);
  authorized = false;
  await page.reload();
  await expect(page).toHaveURL(`${origin}/login`);
  assert.equal(await page.getByLabel('Chave da API').count(), 0);
  await writeFile(`${evidence}/dom-measurements.json`, JSON.stringify(measurements, null, 2));
  console.log(
    'PASS behavior/DOM: admin guard, connect, auth errors, manual model, IME, retry, lost POST response + GET 503/409 + manual recovery clears confirmed draft without replay; unaccepted draft preserved even when identical to history; model lock, rejection, adjustment, all parameters, 375/768/1280 overflow/touch/focus, failed reconciliation and recovery, expiry, 204 disconnect/new session, memory-only state/reload. PNG visual review NOT performed.',
  );
  await page.close();
  await checkImprovements(browser, origin, evidence);
} finally {
  await browser.close();
}
