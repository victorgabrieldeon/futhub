import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon } from '../../components/admin-icon';
import { ChatMessages } from './chat-messages';
import { HistoryPanel } from './history-panel';
import { useAiChat } from './use-ai-chat';
import './ai-chat.css';

const startingPoints = [
  {
    icon: 'collection',
    label: 'Coleção',
    prompt:
      'Quero planejar uma coleção temática de cards. Consulte o catálogo e me ajude a definir o conceito antes de propor criações.',
  },
  {
    icon: 'cards',
    label: 'Card',
    prompt:
      'Quero criar um card de atleta. Consulte os times e coleções disponíveis e me pergunte os dados que faltam antes de propor a criação.',
  },
  {
    icon: 'pack',
    label: 'Pack',
    prompt:
      'Quero montar um pack. Consulte as coleções disponíveis e me ajude a definir elegibilidade, quantidade e preço antes de propor a criação.',
  },
] as const;

export function AiChatPage() {
  const chat = useAiChat();
  const [history, setHistory] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const pending = chat.state?.actions.some((action) => action.status === 'pending') ?? false;
  const empty = !chat.state?.messages.length;
  const models = chat.state?.models ?? chat.saved?.models ?? [];
  useEffect(() => {
    if (!history && chat.state && log.current && follow.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [chat.state, history]);
  return (
    <section className="ai-chat-page">
      <header className="ai-editorial-header">
        <div>
          <p className="eyebrow">FutHub / Assistente IA</p>
          <h1>
            Sala de criação<span>.</span>
          </h1>
        </div>
        <p>
          Do conceito ao catálogo.
          <br />
          Você dirige. A IA propõe. Você aprova.
        </p>
      </header>
      <nav className="ai-history-navigation" aria-label="Conversas do assistente">
        <button
          type="button"
          className="ops-button secondary"
          aria-pressed={!history}
          onClick={() => setHistory(false)}
        >
          Conversa atual
        </button>
        <button
          type="button"
          className="ops-button secondary"
          aria-pressed={history}
          onClick={() => setHistory(true)}
        >
          Histórico
        </button>
      </nav>
      {history ? (
        <HistoryPanel />
      ) : (
        <>
          {chat.error && (
            <div className="ai-error" role="alert">
              {chat.error}
            </div>
          )}
          {chat.reconcile && (
            <div className="ai-recovery">
              <p>
                Resultado ainda não confirmado. Atualize o estado antes de enviar mensagens ou
                aprovar propostas.
              </p>
              <button
                className="ops-button secondary"
                type="button"
                disabled={chat.busy}
                onClick={() => void chat.recover()}
              >
                Atualizar estado
              </button>
            </div>
          )}
          <div className="ai-chat-layout">
            <section
              className={`ai-conversation${empty ? ' ai-conversation--empty' : ''}`}
              aria-label="Conversa com assistente"
            >
              <header>
                <h2>
                  <AdminIcon name="assistant" />
                  Conversa
                </h2>
                <span>Catálogo sob sua direção</span>
              </header>
              <div
                className="ai-conversation-log"
                ref={log}
                role="log"
                aria-label="Mensagens e propostas"
                aria-live="polite"
                aria-busy={chat.busy}
                aria-relevant="additions text"
                onScroll={(event) => {
                  const node = event.currentTarget;
                  follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
                }}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the bounded conversation.
                tabIndex={0}
              >
                {empty && (
                  <div className="ai-empty">
                    <h3>Como posso ajudar?</h3>
                    <p>
                      Uma coleção com história. Um novo atleta no acervo. Um pack para descobrir.
                      Descreva sua ideia e construa a proposta em conversa.
                    </p>
                    {!chat.state && !chat.configLoading && !chat.saved && (
                      <Link className="ops-button accent ai-connect-cta" to="/app/configuracoes">
                        Configurar conexão
                      </Link>
                    )}
                    <div className="ai-starting-points" aria-label="Pontos de partida">
                      {startingPoints.map((point) => (
                        <button
                          key={point.label}
                          type="button"
                          disabled={!chat.state || chat.busy || chat.reconcile}
                          onClick={() => {
                            chat.setDraft(point.prompt);
                            composer.current?.focus();
                          }}
                        >
                          <AdminIcon name={point.icon} />
                          <strong>{point.label}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <ChatMessages
                  state={chat.state}
                  disabled={chat.busy || chat.reconcile}
                  streaming={chat.streaming}
                  decide={chat.decide}
                />
                {chat.state?.notice && (
                  <p className="ai-chat-notice" role="alert">
                    {chat.state.notice}
                  </p>
                )}
              </div>
              <form
                className="ai-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (chat.streaming) chat.stop();
                  else if (!chat.busy) void chat.send();
                }}
              >
                {pending && (
                  <p id="ai-proposal-warning">
                    Enviar um ajuste rejeita todas as propostas pendentes. Criações já concluídas
                    permanecem.
                  </p>
                )}
                <label htmlFor="ai-message">Mensagem</label>
                <textarea
                  id="ai-message"
                  ref={composer}
                  placeholder={
                    chat.state
                      ? 'Pergunte qualquer coisa, / para comandos, @ para contexto…'
                      : 'Conecte seu provedor para iniciar a conversa.'
                  }
                  rows={3}
                  value={chat.draft}
                  disabled={!chat.state || chat.busy || chat.reconcile}
                  onChange={(event) => chat.setDraft(event.target.value)}
                  aria-describedby={pending ? 'ai-proposal-warning ai-send-help' : 'ai-send-help'}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      if (
                        chat.state &&
                        chat.model.trim() &&
                        chat.draft.trim() &&
                        !chat.busy &&
                        !chat.reconcile
                      )
                        void chat.send();
                    }
                  }}
                />
                <div className="ai-composer-footer">
                  <div className="ai-composer-controls">
                    <Link className="ai-provider-control" to="/app/configuracoes">
                      {chat.saved
                        ? chat.saved.provider === 'anthropic'
                          ? 'Anthropic-compatible'
                          : chat.saved.provider === 'opencode-go'
                            ? 'OpenCode Go'
                            : 'OpenAI-compatible'
                        : 'Configurar provider'}
                    </Link>
                    <label>
                      <span className="sr-only">Modelo</span>
                      <select
                        aria-label="Modelo"
                        value={chat.model}
                        disabled={!chat.state || chat.busy || chat.modelLocked}
                        onChange={(event) => chat.setModel(event.target.value)}
                      >
                        <option value="" disabled>
                          Modelo
                        </option>
                        {chat.model && !models.includes(chat.model) && (
                          <option value={chat.model}>{chat.model}</option>
                        )}
                        {models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p id="ai-send-help">Enter envia · Shift+Enter quebra linha</p>
                  <button
                    className="ops-button accent"
                    type="submit"
                    data-streaming={chat.streaming}
                    aria-label={chat.streaming ? 'Interromper resposta' : undefined}
                    disabled={
                      !chat.streaming &&
                      (!chat.state ||
                        !chat.model.trim() ||
                        !chat.draft.trim() ||
                        chat.busy ||
                        chat.reconcile)
                    }
                  >
                    {chat.streaming
                      ? 'Interromper resposta'
                      : chat.busy
                        ? 'Aguarde…'
                        : pending
                          ? 'Ajustar proposta'
                          : 'Enviar'}
                  </button>
                </div>
              </form>
            </section>
          </div>
          <output className="ai-progress">
            {chat.streaming
              ? 'Recebendo resposta em tempo real…'
              : chat.busy
                ? 'Consultando a API…'
                : ''}
          </output>
        </>
      )}
    </section>
  );
}
