import { ApiClientError } from '@futhub/api-client';
import { useEffect, useState } from 'react';
import { AdminIcon } from '../../components/admin-icon';
import {
  type Connection,
  type SavedConnection,
  saveConnection,
  savedConnection,
} from '../ai-chat/api';
import { ConnectionForm } from '../ai-chat/connection-form';
import '../ai-chat/ai-chat.css';

export function AiSettingsPage() {
  const [saved, setSaved] = useState<SavedConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void savedConnection(controller.signal)
      .then(
        (config) => {
          if (!controller.signal.aborted) setSaved(config);
        },
        (reason: unknown) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : 'Falha ao carregar configuração.');
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function save(connection: Connection): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const config = await saveConnection(connection);
      setSaved(config);
      setSuccess('Configuração validada e salva. Assistente pronto para iniciar sessões.');
    } catch (reason) {
      setError(
        reason instanceof ApiClientError || reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar configuração.',
      );
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-chat-page settings-page">
      <header className="command-header">
        <div>
          <p className="eyebrow">Administração · Configurações</p>
          <h1 className="page-title">
            <AdminIcon name="settings" />
            Configurações
          </h1>
          <p>Credenciais e integrações usadas pelo painel administrativo.</p>
        </div>
      </header>
      <nav className="settings-tabs" aria-label="Seções de configurações">
        <span aria-current="page">IA</span>
      </nav>
      <div className="settings-grid">
        <div>
          <p className="eyebrow">Inteligência artificial</p>
          <h2>Provider do assistente</h2>
          <p>
            API key fica cifrada no servidor e nunca retorna ao navegador. Nova chave só é exigida
            ao trocar provider, URL base ou credencial.
          </p>
          {saved && (
            <dl className="settings-summary">
              <div>
                <dt>Status</dt>
                <dd>Configurado</dd>
              </div>
              <div>
                <dt>Modelos</dt>
                <dd>{saved.models.length}</dd>
              </div>
              <div>
                <dt>Último modelo</dt>
                <dd>{saved.model ?? 'Ainda não usado'}</dd>
              </div>
            </dl>
          )}
        </div>
        {loading ? (
          <p>
            <output>Carregando configuração de IA…</output>
          </p>
        ) : (
          <ConnectionForm busy={busy} save={save} saved={saved} />
        )}
      </div>
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="settings-success">
          <output>{success}</output>
        </p>
      )}
    </section>
  );
}
