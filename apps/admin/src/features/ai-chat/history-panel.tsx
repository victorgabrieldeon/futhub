import { useEffect, useRef, useState } from 'react';
import { ChatMessages } from './chat-messages';
import {
  type HistoryDetail,
  type HistoryPage,
  loadHistory,
  loadHistoryDetail,
} from './history-api';

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export function HistoryPanel() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [list, setList] = useState<HistoryPage | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries the same read-only request.
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setDetail(null);
    setList(null);
    const task = selected
      ? loadHistoryDetail(selected, controller.signal).then((value) => {
          if (!controller.signal.aborted) setDetail(value);
        })
      : loadHistory(page, controller.signal).then((value) => {
          if (!controller.signal.aborted) setList(value);
        });
    void task
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    heading.current?.focus();
    return () => controller.abort();
  }, [page, selected, attempt]);

  return (
    <section className="ai-history cards-panel" aria-label="Histórico de conversas">
      <header className="ai-history-header">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {detail?.title || 'Histórico de conversas'}
          </h2>
          <p>
            Somente leitura. Conversas salvas no servidor, sem chaves. Não é possível retomar nem
            executar propostas aqui.
          </p>
        </div>
        {selected && (
          <button className="ops-button secondary" type="button" onClick={() => setSelected(null)}>
            Voltar à lista
          </button>
        )}
        <button
          type="button"
          className="ops-button secondary"
          disabled={busy}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Atualizar histórico
        </button>
      </header>
      {busy && <output>Carregando histórico…</output>}
      {error && <p role="alert">{error} Use Atualizar histórico para tentar novamente.</p>}
      {!busy && !error && list && (
        <>
          {!list.items.length && <p>Nenhuma conversa salva nesta página.</p>}
          <ul className="ai-history-list">
            {list.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="ops-button secondary"
                  onClick={() => setSelected(item.id)}
                >
                  {item.title || 'Conversa sem título'}
                </button>
                <p>
                  {item.provider === 'openai'
                    ? 'OpenAI'
                    : item.provider === 'opencode-go'
                      ? 'OpenCode Go'
                      : 'Anthropic'}{' '}
                  · {item.model || 'Modelo não informado'}
                </p>
                <p>
                  Atualizada em <time dateTime={item.updatedAt}>{date(item.updatedAt)}</time>
                </p>
              </li>
            ))}
          </ul>
          <nav className="ai-history-pagination" aria-label="Paginação do histórico">
            <button
              type="button"
              className="ops-button secondary"
              disabled={list.page <= 1}
              onClick={() => setPage(list.page - 1)}
            >
              Página anterior
            </button>
            <output>
              Página {list.page} de {Math.max(1, Math.ceil(list.total / list.pageSize))} ·{' '}
              {list.total} conversas
            </output>
            <button
              type="button"
              className="ops-button secondary"
              disabled={list.page * list.pageSize >= list.total}
              onClick={() => setPage(list.page + 1)}
            >
              Próxima página
            </button>
          </nav>
        </>
      )}
      {!busy && !error && detail && (
        <div className="ai-history-detail">
          <p>
            {detail.provider === 'openai'
              ? 'OpenAI'
              : detail.provider === 'opencode-go'
                ? 'OpenCode Go'
                : 'Anthropic'}{' '}
            · {detail.model || 'Modelo não informado'}
          </p>
          <p>
            Criada em <time dateTime={detail.createdAt}>{date(detail.createdAt)}</time> · Atualizada
            em <time dateTime={detail.updatedAt}>{date(detail.updatedAt)}</time>
          </p>
          {!detail.state.messages.length && <p>Esta conversa ainda não tem mensagens.</p>}
          <ChatMessages state={detail.state} readOnly />
        </div>
      )}
    </section>
  );
}
