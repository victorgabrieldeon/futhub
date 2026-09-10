import { ApiClientError } from '@futhub/api-client';
import { useEffect, useRef, useState } from 'react';
import {
  type AiChatState,
  type SavedConnection,
  chatRequest,
  disconnectSession,
  savedConnection,
  sessionPath,
} from './api';
import { applyStreamEvent, streamRequest } from './stream';

export function useAiChat() {
  const [state, setState] = useState<AiChatState | null>(null);
  const [saved, setSaved] = useState<SavedConnection | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [model, setModel] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const [modelLocked, setModelLocked] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const pendingMessage = useRef<{ offset: number; content: string } | null>(null);
  useEffect(() => {
    active.current = true;
    const configController = new AbortController();
    void savedConnection(configController.signal).then(
      (config) => {
        if (configController.signal.aborted) return;
        setSaved(config);
        setConfigLoading(false);
        if (config) {
          setModel(config.model ?? config.models[0] ?? '');
          void connect(config);
        }
      },
      (reason: unknown) => {
        if (configController.signal.aborted) return;
        fail(reason);
        setConfigLoading(false);
      },
    );
    return () => {
      active.current = false;
      configController.abort();
      controller.current?.abort();
    };
  }, []);

  function clear() {
    pendingMessage.current = null;
    setState(null);
    setModel('');
    setDraft('');
    setReconcile(false);
    setModelLocked(false);
  }

  function fail(reason: unknown) {
    if (reason instanceof ApiClientError && reason.status === 404) {
      clear();
      setError('Sessão de IA expirada ou encerrada. Conecte novamente para iniciar uma conversa.');
      return;
    }
    setError(reason instanceof Error ? reason.message : 'Falha inesperada. Tente novamente.');
  }

  async function run(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (reason) {
      if (active.current) fail(reason);
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  }

  function accept(next: AiChatState) {
    setState(next);
    if (next.model !== null) setModel(next.model);
    if (next.messages.length) setModelLocked(true);
  }

  async function refresh(id: string) {
    const next = await chatRequest(sessionPath(id));
    if (next.id !== id)
      throw new Error('A API retornou outra sessão. Atualize o estado novamente.');
    if (active.current) {
      accept(next);
      const submitted = pendingMessage.current;
      if (
        submitted &&
        next.messages
          .slice(submitted.offset)
          .some((message) => message.role === 'user' && message.content === submitted.content)
      )
        setDraft('');
      pendingMessage.current = null;
      setReconcile(false);
    }
    return next;
  }

  function connect(config = saved) {
    return run(async () => {
      if (!config) throw new Error('Configure um provedor de IA antes de iniciar o assistente.');
      const next = await chatRequest('/v1/admin/ai/sessions/saved', {
        method: 'POST',
      });
      if (!active.current) {
        await disconnectSession(next.id);
        return;
      }
      accept(next);
      setModel(next.model ?? next.models[0] ?? '');
    });
  }

  const send = () =>
    run(async () => {
      if (!state || !model.trim() || !draft.trim() || reconcile) return;
      setModelLocked(true);
      pendingMessage.current = { offset: state.messages.length, content: draft.trim() };
      const completed = await stream(`${sessionPath(state.id)}/messages/stream`, {
        model: model.trim(),
        message: draft.trim(),
      });
      if (completed && active.current) {
        pendingMessage.current = null;
        setDraft('');
      }
    });

  const decide = (actionId: string, approved: boolean) =>
    run(async () => {
      if (
        !state ||
        reconcile ||
        !state.actions.some((action) => action.id === actionId && action.status === 'pending')
      )
        return;
      await stream(`${sessionPath(state.id)}/actions/${encodeURIComponent(actionId)}/stream`, {
        approved,
      });
    });

  async function stream(path: string, body: unknown) {
    if (!state) return false;
    let current = state;
    const abort = new AbortController();
    controller.current = abort;
    setStreaming(true);
    try {
      await streamRequest({
        path,
        body,
        signal: abort.signal,
        onEvent: (event) => {
          current = applyStreamEvent(current, event);
          if (active.current) accept(current);
        },
      });
      return true;
    } catch (reason) {
      if (active.current) {
        if (reason instanceof ApiClientError && reason.status === 404) throw reason;
        setReconcile(true);
        setStreaming(false);
        await refresh(state.id);
        if (active.current)
          setError(
            abort.signal.aborted
              ? 'Espera interrompida. Estado consultado; nada foi reenviado. Confira a conversa antes de continuar.'
              : `${reason instanceof Error ? reason.message : 'Resposta não confirmada.'} Estado consultado; nada foi reenviado. Confira a conversa.`,
          );
      }
      return false;
    } finally {
      controller.current = null;
      if (active.current) setStreaming(false);
    }
  }

  const disconnect = () =>
    run(async () => {
      if (!state) return;
      await disconnectSession(state.id);
      if (active.current) clear();
    });
  const recover = () =>
    run(async () => {
      if (state) await refresh(state.id);
    });
  return {
    state,
    saved,
    configLoading,
    model,
    setModel,
    draft,
    setDraft,
    error,
    busy,
    reconcile,
    modelLocked,
    streaming,
    stop: () => controller.current?.abort(),
    connect,
    send,
    decide,
    disconnect,
    recover,
  };
}
