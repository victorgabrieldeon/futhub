'use client';

import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: form.get('apiKey') }),
    });
    if (response.ok) {
      window.location.assign('/dashboard');
      return;
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? 'Não foi possível autenticar.');
    setPending(false);
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <p className="eyebrow">Acesso restrito</p>
      <h1>FutHub Admin</h1>
      <p className="intro">Use API key para operar configurações do jogo.</p>
      <label htmlFor="apiKey">API key</label>
      <input
        autoComplete="current-password"
        id="apiKey"
        name="apiKey"
        placeholder="Cole sua chave de acesso"
        required
        type="password"
      />
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button-primary" disabled={pending} type="submit">
        {pending ? 'Validando…' : 'Entrar no painel'}
      </button>
      <p className="form-note">A chave fica somente em cookie de sessão HTTP-only.</p>
    </form>
  );
}
