import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { expect } from '@playwright/test';

export async function checkImprovements(browser, origin, evidence) {
  const page = await browser.newPage();
  const calls = [];
  let mode = 'held';
  let held;
  let web = true;
  let historyError = false;
  let getError = false;
  let capabilityError = false;
  let config = null;
  let state = {
    id: 'stream-session',
    models: ['qa-model'],
    model: null,
    notice: null,
    messages: [],
    actions: [],
  };
  const proposal = {
    id: 'action-1',
    tool: 'create_team',
    arguments: '{"name":"Time persistido"}',
    status: 'pending',
    result: null,
  };
  const sources = [
    {
      title: 'Fonte segura',
      url: 'https://example.com/noticia?q=bola',
      description: 'Descrição <img src=x onerror=alert(1)>',
    },
    { title: 'HTTP permitido', url: 'http://example.com/futebol', description: 'Outra fonte' },
    ...[
      'javascript:alert(1)',
      'https://user:secret@example.com/',
      'data:text/html,test',
      '//example.com',
      'not a url',
    ].map((url) => ({ title: 'Endereço recusado', url, description: 'Texto sem link' })),
  ];
  const saved = (id) => ({
    id,
    title: `Conversa salva ${id}`,
    provider: 'openai',
    model: 'qa-model',
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-05T12:00:00Z',
  });
  const stored = {
    ...state,
    id: 'saved-1',
    messages: [
      { id: 'saved-tool', role: 'tool', content: JSON.stringify({ query: 'Futebol', sources }) },
    ],
    actions: [proposal],
  };
  const event = (res, value) => res.write(`data: ${JSON.stringify(value)}\r\n\r\n`);
  const finish = () => {
    state = {
      ...state,
      messages: [
        ...state.messages.filter((message) => message.role === 'user'),
        {
          id: 'answer',
          role: 'assistant',
          content: 'Resposta final canônica, sem duplicar deltas.',
        },
        { id: 'web', role: 'tool', content: JSON.stringify({ query: 'Futebol', sources }) },
      ],
      actions: [proposal],
    };
    event(held, { type: 'state', state });
    event(held, { type: 'done' });
    held.end();
  };
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    const path = new URL(req.url, origin);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    calls.push({ path: path.pathname, query: path.search, method: req.method, body });
    assert.equal(req.headers.authorization, undefined);
    const json = (value, status = 200) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    if (path.pathname.endsWith('/capabilities'))
      return capabilityError
        ? json({ message: 'Falha de capacidade QA' }, 503)
        : json({ webSearch: web });
    if (path.pathname.endsWith('/history')) {
      if (historyError) return json({ message: 'Histórico indisponível QA' }, 503);
      const number = Number(path.searchParams.get('page'));
      return json({ items: [saved(`saved-${number}`)], total: 2, page: number, pageSize: 1 });
    }
    if (path.pathname.includes('/history/')) {
      const id = path.pathname.split('/').at(-1);
      return json({ ...saved(id), state: { ...stored, id } });
    }
    if (path.pathname.endsWith('/config')) return json(config);
    if (path.pathname.endsWith('/sessions')) {
      if (
        !body.apiKey &&
        (!config || body.provider !== config.provider || body.baseUrl !== config.baseUrl)
      )
        return json({ message: 'Nova chave necessária QA' }, 400);
      config = {
        provider: body.provider,
        baseUrl: body.baseUrl,
        apiKeyConfigured: true,
        models: ['qa-model'],
        model: state.model,
      };
      return json(state);
    }
    if (req.method === 'GET')
      return getError ? json({ message: 'Sessão ocupada QA' }, 409) : json(state);
    assert.ok(path.pathname.endsWith('/stream'), 'Mutations must use stream routes');
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    res.flushHeaders();
    held = res;
    if (path.pathname.includes('/actions/')) {
      state = {
        ...state,
        actions: [
          { ...proposal, status: body.approved ? 'succeeded' : 'rejected', result: 'Registrado' },
        ],
      };
      event(res, { type: 'state', state });
      event(res, { type: 'text', messageId: 'action-answer', delta: 'Decisão em andamento' });
      return;
    }
    state = {
      ...state,
      model: body.model,
      messages: [
        ...state.messages,
        { id: `user-${calls.length}`, role: 'user', content: body.message },
      ],
      actions: [{ ...proposal, arguments: '{"name":' }],
    };
    event(res, { type: 'state', state });
    if (mode === 'state-only') {
      res.end();
      return;
    }
    if (mode === 'error') {
      event(res, { type: 'error', message: 'Provedor interrompeu QA' });
      res.end();
      return;
    }
    if (mode === 'malformed') {
      res.end('data: {broken}\n\n');
      return;
    }
    // Split an SSE frame and a UTF-8 character across real network writes.
    const delta = Buffer.from(
      `data: ${JSON.stringify({ type: 'text', messageId: 'answer', delta: 'Texto parcial: ação' })}\r\n\r\n`,
    );
    const split = delta.indexOf(Buffer.from('ç')) + 1;
    res.write(delta.subarray(0, split));
    setTimeout(() => {
      if (res.destroyed) return;
      res.write(delta.subarray(split));
      if (mode === 'done-after-text') {
        event(res, { type: 'done' });
        res.end();
      }
    }, 20);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  try {
    await page.route('**/v1/admin/session', (route) =>
      route.fulfill({ json: { authorized: true } }),
    );
    await page.route('**/v1/admin/ai/**', (route) =>
      route.continue({ url: route.request().url().replace(origin, `http://127.0.0.1:${port}`) }),
    );
    await page.goto(`${origin}/app/assistente`);
    await expect(page.getByText('Consulta web disponível.', { exact: false })).toBeVisible();
    await page.getByLabel('Chave da API').fill('qa-only-key');
    await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
    const prompt = page.getByLabel('Mensagem', { exact: true });
    await prompt.fill('Pesquisar futebol');
    await prompt.press('Enter');
    await expect(page.getByText('Texto parcial: ação', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar criação' })).toBeDisabled();
    await expect(prompt).toBeDisabled();
    assert.equal(calls.filter((call) => call.path.endsWith('/messages/stream')).length, 1);
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `${evidence}/streaming-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    finish();
    await expect(prompt).toBeEnabled();
    await expect(prompt).toHaveValue('');
    await expect(page.getByText('Texto parcial: ação', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Resposta final canônica, sem duplicar deltas.', { exact: true }),
    ).toHaveCount(1);
    const toolResult = page.locator('details.ai-tool-result').last();
    await expect(toolResult).not.toHaveAttribute('open', '');
    await expect(toolResult.locator('.ai-web-results')).toBeHidden();
    await toolResult.locator('summary').click();
    await expect(toolResult.locator('.ai-web-results')).toBeVisible();
    await expect(page.locator('.ai-web-results a')).toHaveCount(2);
    for (const link of await page.locator('.ai-web-results a').all()) {
      assert.ok(/^https?:/.test(await link.getAttribute('href')));
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      await link.focus();
      await expect(link).toBeFocused();
    }
    assert.equal(await page.locator('.ai-web-results img, .ai-web-results script').count(), 0);
    await page.getByRole('button', { name: 'Confirmar criação' }).click();
    await expect(page.getByText('Decisão em andamento', { exact: true })).toBeVisible();
    await expect(prompt).toBeDisabled();
    event(held, { type: 'state', state });
    event(held, { type: 'done' });
    held.end();
    await expect(prompt).toBeEnabled();
    assert.equal(calls.filter((call) => call.path.includes('/actions/')).length, 1);
    for (const failure of ['state-only', 'error', 'malformed', 'done-after-text']) {
      mode = failure;
      const before = calls.length;
      await prompt.fill(`Tentativa ${failure}`);
      await prompt.press('Enter');
      await expect(page.getByRole('alert')).toContainText('nada foi reenviado');
      await expect(prompt).toBeEnabled();
      assert.equal(calls.slice(before).filter((call) => call.method === 'POST').length, 1);
      assert.equal(calls.slice(before).filter((call) => call.method === 'GET').length, 1);
      await expect(page.getByRole('button', { name: 'Confirmar criação' })).toBeDisabled();
    }
    mode = 'held';
    await prompt.fill('Cancelar espera');
    await prompt.press('Enter');
    await expect(page.getByRole('button', { name: 'Interromper espera' })).toBeVisible();
    getError = true;
    await page.getByRole('button', { name: 'Interromper espera' }).click();
    await expect(page.getByRole('button', { name: 'Atualizar estado' })).toBeEnabled();
    await expect(prompt).toBeDisabled();
    getError = false;
    const mutationCount = calls.filter((call) => call.method === 'POST').length;
    await page.getByRole('button', { name: 'Atualizar estado' }).click();
    await expect(prompt).toBeEnabled();
    await expect(prompt).toHaveValue('');
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Conversa salva saved-1' })).toBeVisible();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `${evidence}/history-list-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    await page.getByRole('button', { name: 'Próxima página' }).click();
    await expect(page.getByRole('button', { name: 'Conversa salva saved-2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    await page.getByRole('button', { name: 'Página anterior' }).click();
    await page.getByRole('button', { name: 'Conversa salva saved-1' }).click();
    await expect(page.getByRole('heading', { name: 'Conversa salva saved-1' })).toBeVisible();
    assert.equal(await page.getByLabel('Mensagem', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Confirmar criação|Rejeitar/ }).count(), 0);
    await expect(page.getByText('Somente leitura.', { exact: false }).first()).toBeVisible();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `${evidence}/history-detail-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    await page.getByRole('button', { name: 'Conversa atual', exact: true }).click();
    await expect(prompt).toBeEnabled();
    assert.equal(calls.filter((call) => call.method === 'POST').length, mutationCount);
    web = false;
    await page.reload();
    await expect(page.getByText('Consulta web indisponível', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    await page.getByRole('button', { name: 'Conversa salva saved-1' }).click();
    await expect(page.getByRole('heading', { name: 'Conversa salva saved-1' })).toBeVisible();
    assert.equal(await page.getByRole('button', { name: /Confirmar criação|Rejeitar/ }).count(), 0);
    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    historyError = true;
    await page.getByRole('button', { name: 'Atualizar histórico' }).click();
    await expect(page.getByRole('alert')).toContainText('Histórico indisponível QA');
    historyError = false;
    await page.getByRole('button', { name: 'Atualizar histórico' }).click();
    await expect(page.getByRole('button', { name: 'Conversa salva saved-1' })).toBeVisible();
    capabilityError = true;
    await page.getByRole('button', { name: 'Conversa atual', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Verificar consulta web' })).toBeVisible();
    capabilityError = false;
    await page.getByRole('button', { name: 'Verificar consulta web' }).click();
    await expect(page.getByText('Consulta web indisponível', { exact: false })).toBeVisible();
    const key = page.getByLabel('Chave da API');
    const baseUrl = page.getByLabel('URL base');
    const provider = page.getByLabel('Protocolo');
    await expect(key).toHaveValue('');
    await expect(baseUrl).toHaveValue(config.baseUrl);
    await expect(provider).toHaveValue(config.provider);
    const beforeConfig = calls.filter((call) => call.method === 'POST').length;
    await provider.selectOption('anthropic');
    await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
    assert.equal(await key.evaluate((input) => input.validity.valueMissing), true);
    assert.equal(calls.filter((call) => call.method === 'POST').length, beforeConfig);
    await provider.selectOption('openai');
    await baseUrl.fill('https://alternate.example.com/v1');
    await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
    assert.equal(await key.evaluate((input) => input.validity.valueMissing), true);
    assert.equal(calls.filter((call) => call.method === 'POST').length, beforeConfig);
    await baseUrl.fill(config.baseUrl);
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await expect(prompt).toBeEnabled();
    assert.deepEqual(calls.findLast((call) => call.path.endsWith('/sessions')).body, {
      provider: config.provider,
      baseUrl: config.baseUrl,
    });
    await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('qa-model');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeEnabled();
    await expect(key).toHaveValue('');
    await baseUrl.fill('https://alternate.example.com/v1');
    await key.fill('qa-replacement-key');
    await page.getByRole('button', { name: 'Salvar e conectar', exact: true }).click();
    await expect(prompt).toBeEnabled();
    assert.deepEqual(calls.findLast((call) => call.path.endsWith('/sessions')).body, {
      provider: 'openai',
      baseUrl: 'https://alternate.example.com/v1',
      apiKey: 'qa-replacement-key',
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeEnabled();
    await expect(baseUrl).toHaveValue('https://alternate.example.com/v1');
    await expect(key).toHaveValue('');
    assert.equal(
      await page.evaluate(() =>
        /qa-only-key|qa-replacement-key|stream-session|saved-1/.test(
          JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
        ),
      ),
      false,
    );
    await writeFile(
      `${evidence}/stream-history-checks.json`,
      JSON.stringify(
        {
          status: 'PASS behavior only',
          streaming: 'real chunked HTTP with held EOF',
          calls: calls.map(({ body, ...call }) => call),
          scenarios: [
            'delta before EOF',
            'UTF-8 split',
            'authoritative replacement',
            'done required',
            'error',
            'malformed',
            'invalid completion order',
            'action streaming',
            'abort + GET 409',
            'manual no-replay recovery',
            'read-only history',
            'pagination',
            'reload',
            'history retry',
            'safe source URLs',
            'capability disabled/error/retry',
            'saved config reload without secret',
            'saved key reuse omits apiKey',
            'provider/URL change requires key',
            'save and connect with replacement key',
            'browser storage contains no key',
          ],
          visualReview: 'Screenshots captured; independent review pending',
        },
        null,
        2,
      ),
    );
    console.log(
      'PASS streaming/history/web browser checks (real chunked HTTP). Visual review pending.',
    );
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
