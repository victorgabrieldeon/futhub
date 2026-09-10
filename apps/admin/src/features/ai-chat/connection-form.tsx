import { useEffect, useState } from 'react';
import type { Connection, SavedConnection } from './api';

export function ConnectionForm({
  busy,
  save,
  saved,
}: Readonly<{
  busy: boolean;
  save: (value: Connection) => Promise<void>;
  saved: SavedConnection | null;
}>) {
  const [provider, setProvider] = useState<Connection['provider']>('opencode-go');
  const [baseUrl, setBaseUrl] = useState('https://opencode.ai/zen/go/v1');
  const [apiKey, setApiKey] = useState('');
  const canReuse =
    saved?.apiKeyConfigured && saved.provider === provider && saved.baseUrl === baseUrl.trim();
  useEffect(() => {
    if (!saved) return;
    setProvider(saved.provider);
    setBaseUrl(saved.baseUrl);
  }, [saved]);
  return (
    <form
      className="ai-connection cards-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const credentials = { provider, baseUrl: baseUrl.trim(), apiKey: apiKey.trim() };
        void save(credentials)
          .then(() => setApiKey(''))
          .catch(() => undefined);
      }}
    >
      <div>
        <p className="eyebrow">Provider principal</p>
        <h2>Conexão do assistente</h2>
      </div>
      <label>
        Protocolo
        <select
          value={provider}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value;
            if (next !== 'openai' && next !== 'opencode-go' && next !== 'anthropic') return;
            setProvider(next);
            setBaseUrl(
              next === 'openai'
                ? 'https://api.openai.com/v1'
                : next === 'opencode-go'
                  ? 'https://opencode.ai/zen/go/v1'
                  : 'https://api.anthropic.com/v1',
            );
          }}
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="opencode-go">OpenCode Go</option>
          <option value="anthropic">Anthropic-compatible</option>
        </select>
      </label>
      <label>
        URL base
        <input
          type="url"
          required
          pattern="https://.+"
          value={baseUrl}
          disabled={busy}
          onChange={(event) => setBaseUrl(event.target.value)}
          aria-describedby="ai-url-help"
        />
      </label>
      <p id="ai-url-help">
        Somente URLs HTTPS públicas. Endereços privados e locais são recusados pelo servidor.
      </p>
      <label>
        Chave da API
        <input
          type="password"
          required={!canReuse}
          value={apiKey}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          onChange={(event) => setApiKey(event.target.value)}
          aria-describedby="ai-privacy"
        />
      </label>
      <p id="ai-privacy">
        {canReuse
          ? 'Configuração salva. Deixe este campo vazio para reutilizar a chave salva; preencha-o para substituí-la.'
          : 'A chave será salva cifrada no servidor e nunca será exibida novamente nesta tela.'}{' '}
        URL base, provedor, modelos descobertos e último modelo também são salvos. Mensagens e dados
        do catálogo consultados serão enviados ao provedor escolhido pela API administrativa.
      </p>
      <button className="ops-button accent" disabled={busy} type="submit">
        {busy ? 'Validando…' : canReuse && !apiKey ? 'Validar configuração' : 'Salvar configuração'}
      </button>
    </form>
  );
}
