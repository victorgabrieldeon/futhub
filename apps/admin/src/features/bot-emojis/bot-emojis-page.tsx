import {
  ApiClientError,
  type BotEmojiDto,
  type BotEmojiListDto,
  request,
} from '@futhub/api-client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import './bot-emojis.css';
import { mayLoseAnimation, needsResize, prepareEmojiImage } from './emoji-image';
import { emojiNameFromFile } from './emoji-name';

type BotEmoji = BotEmojiDto;

const namePattern = /^[A-Za-z0-9_]{2,32}$/;

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
  if (cause instanceof ApiClientError)
    return cause.message.replace(/^FutHub API request failed with status \d+: /, '');
  return 'Não foi possível concluir a solicitação.';
}

function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const options = adminApiOptions();
  return request<T>(path, {
    ...options,
    method,
    headers:
      body === undefined
        ? options.headers
        : { ...options.headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function UploadForm({ onCreated }: { onCreated: (emoji: BotEmoji) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function reset() {
    setImage('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function choose(file: File | undefined) {
    setError('');
    setNotice('');
    setImage('');
    if (!file) return;
    if (
      needsResize(file) &&
      mayLoseAnimation(file) &&
      !window.confirm(
        'Esta imagem passa de 256 KiB e precisa ser reduzida. Se for animada, só o primeiro quadro será mantido. Continuar?',
      )
    ) {
      reset();
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareEmojiImage(file);
      setImage(prepared.dataUrl);
      if (prepared.resized)
        setNotice(
          `Redimensionada de ${prepared.resized.from.join('×')} para ${prepared.resized.to.join('×')} px (PNG).`,
        );
      setName((current) => current || emojiNameFromFile(file.name));
    } catch (cause) {
      reset();
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler esta imagem.');
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!image || !namePattern.test(name) || pending) return;
    setPending(true);
    setError('');
    try {
      onCreated(await call<BotEmoji>('/v1/admin/bot-emojis', 'POST', { name, image }));
      reset();
      setName('');
      setNotice('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="emoji-upload" onSubmit={(event) => void submit(event)} aria-busy={pending}>
      <div className="emoji-upload-preview" aria-hidden="true">
        {image ? <img src={image} alt="" /> : <span>+</span>}
      </div>
      <label className="emoji-field">
        Imagem
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={pending || preparing}
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <small>
          {preparing
            ? 'Preparando imagem…'
            : notice ||
              'Qualquer imagem até 20 MB. Acima de 256 KiB, ela é reduzida para 128 px. GIFs pequenos mantêm a animação.'}
        </small>
      </label>
      <label className="emoji-field">
        Nome
        <input
          value={name}
          disabled={pending}
          maxLength={32}
          pattern="[A-Za-z0-9_]{2,32}"
          placeholder="moeda"
          required
          onChange={(event) => setName(event.target.value.replace(/[^A-Za-z0-9_]/g, '_'))}
        />
        <small>
          Use nas respostas como <code>{`{emoji:${name || 'nome'}}`}</code>
        </small>
      </label>
      <button
        className="ops-button accent"
        type="submit"
        disabled={pending || preparing || !image || !namePattern.test(name)}
      >
        {pending ? 'Enviando…' : 'Adicionar emoji'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function EmojiCard({
  emoji,
  onRenamed,
  onDeleted,
}: {
  emoji: BotEmoji;
  onRenamed: (emoji: BotEmoji) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(emoji.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const token = `{emoji:${emoji.name}}`;

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (name === emoji.name) {
      setEditing(false);
      return;
    }
    if (
      !window.confirm(
        `Renomear para ${name}? Respostas que usam {emoji:${emoji.name}} passarão a mostrar :${emoji.name}: até serem atualizadas.`,
      )
    )
      return;
    setPending(true);
    setError('');
    try {
      onRenamed(
        await call<BotEmoji>(`/v1/admin/bot-emojis/${encodeURIComponent(emoji.id)}`, 'PATCH', {
          name,
        }),
      );
      setEditing(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Remover ${emoji.name} do bot? Respostas que usam ${token} passarão a mostrar :${emoji.name}:.`,
      )
    )
      return;
    setPending(true);
    setError('');
    try {
      await call<void>(`/v1/admin/bot-emojis/${encodeURIComponent(emoji.id)}`, 'DELETE');
      onDeleted(emoji.id);
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Não foi possível copiar. Selecione o código manualmente.');
    }
  }

  return (
    <li className="emoji-card" aria-busy={pending}>
      <img src={emoji.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      {editing ? (
        <form className="emoji-rename" onSubmit={(event) => void rename(event)}>
          <label className="sr-only" htmlFor={`emoji-${emoji.id}`}>
            Novo nome de {emoji.name}
          </label>
          <input
            id={`emoji-${emoji.id}`}
            value={name}
            disabled={pending}
            maxLength={32}
            pattern="[A-Za-z0-9_]{2,32}"
            required
            onChange={(event) => setName(event.target.value.replace(/[^A-Za-z0-9_]/g, '_'))}
          />
          <button className="ops-button accent" type="submit" disabled={pending}>
            Salvar
          </button>
          <button
            className="ops-button secondary"
            type="button"
            disabled={pending}
            onClick={() => {
              setName(emoji.name);
              setEditing(false);
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="emoji-card-body">
          <strong>
            {emoji.name}
            {emoji.animated && <span className="emoji-badge">Animado</span>}
          </strong>
          <button
            className="emoji-token"
            type="button"
            onClick={() => void copy()}
            title="Copiar código para usar nas respostas"
          >
            <code>{token}</code>
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          <div className="emoji-card-actions">
            <button
              className="ops-button secondary"
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Renomear
            </button>
            <button
              className="ops-button danger"
              type="button"
              disabled={pending}
              aria-label={`Remover ${emoji.name}`}
              onClick={() => void remove()}
            >
              Remover
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function BotEmojisPage() {
  const [list, setList] = useState<BotEmojiListDto | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts this GET.
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const options = adminApiOptions();
    void request<BotEmojiListDto>('/v1/admin/bot-emojis', {
      ...options,
      method: 'GET',
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setList(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [retry]);

  const update = (emojis: (current: BotEmoji[]) => BotEmoji[]) =>
    setList((current) =>
      current
        ? {
            ...current,
            emojis: emojis(current.emojis).sort((a, b) => a.name.localeCompare(b.name)),
          }
        : current,
    );
  const normalized = query.trim().toLowerCase();
  const visible =
    list?.emojis.filter((emoji) => emoji.name.toLowerCase().includes(normalized)) ?? [];

  return (
    <section className="bot-emojis" aria-labelledby="emojis-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Operação / Discord</p>
          <h1 className="page-title" id="emojis-title">
            <AdminIcon className="page-title-icon" name="assistant" />
            <span>Emojis do bot</span>
          </h1>
          <p>
            Emojis enviados aqui pertencem ao bot e funcionam em qualquer servidor. Use{' '}
            <code>{'{emoji:nome}'}</code> nos textos das respostas ou escolha um emoji nos botões.
          </p>
        </div>
      </header>
      <UploadForm onCreated={(emoji) => update((emojis) => [...emojis, emoji])} />
      {error ? (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button
            type="button"
            className="ops-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !list ? (
        <output>Carregando emojis do Discord…</output>
      ) : (
        <>
          <div className="emoji-toolbar">
            <label className="emoji-field">
              <span className="sr-only">Buscar emoji</span>
              <input
                type="search"
                placeholder="Buscar por nome"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <output>
              {list.emojis.length} de {list.limit} emojis
            </output>
          </div>
          {visible.length ? (
            <ul className="emoji-grid">
              {visible.map((emoji) => (
                <EmojiCard
                  key={emoji.id}
                  emoji={emoji}
                  onRenamed={(renamed) =>
                    update((emojis) =>
                      emojis.map((item) => (item.id === renamed.id ? renamed : item)),
                    )
                  }
                  onDeleted={(id) => update((emojis) => emojis.filter((item) => item.id !== id))}
                />
              ))}
            </ul>
          ) : (
            <p className="emoji-empty">
              {list.emojis.length
                ? 'Nenhum emoji encontrado para esta busca.'
                : 'Nenhum emoji cadastrado. Envie o primeiro acima.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
