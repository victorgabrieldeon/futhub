import {
  ApiClientError,
  type BotResponseDefinitionDto,
  type BotResponseTemplateDto,
  request,
} from '@futhub/api-client';
import {
  type Definition,
  type Template,
  createScope,
  exampleData,
  pipes,
  validateTemplate,
} from '@futhub/bot-templates';
import {
  type FormEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import {
  type AdminEmoji,
  ComponentsEditor,
  LegacyEditor,
  TemplateAssets,
  type TextFocus,
} from './editor';
import { attachImage, changeMode, componentCount, createResponseDrafts } from './helpers';
import { ImageDesigner } from './image-designer';
import { ListsEditor } from './lists-editor';
import { type ListSimulation, Preview } from './preview';
import './bot-responses.css';

type Tab = 'message' | 'lists' | 'images';

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
  return cause instanceof Error ? cause.message : 'Não foi possível concluir a solicitação.';
}

const DraftContext = createContext<ReturnType<typeof createResponseDrafts> | null>(null);

export function BotResponseDraftScope({ children }: { children: ReactNode }) {
  const [drafts] = useState(createResponseDrafts);
  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!drafts.hasUnsaved()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => {
      window.removeEventListener('beforeunload', preventUnload);
      drafts.clear();
    };
  }, [drafts]);
  return <DraftContext.Provider value={drafts}>{children}</DraftContext.Provider>;
}

export function BotResponsesPage() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('BotResponsesPage requires an authenticated draft scope.');
  const drafts = context;
  const [params, setParams] = useSearchParams();
  const [schema, setSchema] = useState<BotResponseDefinitionDto[] | null>(null);
  const [schemaError, setSchemaError] = useState('');
  const [schemaRetry, setSchemaRetry] = useState(0);
  const [activeKey, setActiveKey] = useState('');
  const draft = useSyncExternalStore(drafts.subscribe, () => drafts.get(activeKey));
  const template = draft?.template ?? null;
  const baseline = draft?.baseline ?? '';
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = draft?.pending ?? false;
  const focus: TextFocus = useRef(null);
  const dirty = template !== null && JSON.stringify(template) !== baseline;
  const requested = params.get('resposta') ?? schema?.[0]?.key ?? '';
  const definition = schema?.find((item) => item.key === activeKey);
  const entry = definition as Definition | undefined;
  const current = template as Template | null;
  const [tab, setTab] = useState<Tab>('message');
  const [simulation, setSimulation] = useState<ListSimulation>('examples');
  const [emojis, setEmojis] = useState<AdminEmoji[]>([]);
  const scope = useMemo(() => {
    if (!entry) return null;
    const data = exampleData(entry);
    for (const list of entry.lists)
      data[list.name] =
        simulation === 'empty'
          ? []
          : simulation === 'many'
            ? Array.from({ length: 12 }, (_, i) => ({
                ...list.examples[i % list.examples.length],
              }))
            : list.examples;
    return createScope(current ?? {}, data, entry, emojis);
  }, [entry, current, simulation, emojis]);
  const assets = useMemo(
    () => ({ images: (current?.images ?? []).map((image) => image.id), emojis }),
    [current, emojis],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Emojis are optional: without Discord credentials the editor simply hides the picker.
    void request<{ emojis: AdminEmoji[] }>('/v1/admin/bot-emojis', {
      ...adminApiOptions(),
      method: 'GET',
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setEmojis(result.emojis);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts this GET.
  useEffect(() => {
    const controller = new AbortController();
    setSchemaError('');
    const options = adminApiOptions();
    void request<BotResponseDefinitionDto[]>('/v1/admin/bot-responses/schema', {
      ...options,
      method: 'GET',
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setSchema(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setSchemaError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [schemaRetry]);

  useEffect(() => {
    if (!schema || requested === activeKey) return;
    if (
      pending ||
      (dirty && !window.confirm('Descartar alterações não salvas e trocar de resposta?'))
    ) {
      setParams(
        (current) => {
          current.set('resposta', activeKey);
          return current;
        },
        { replace: true },
      );
      return;
    }
    if (dirty) drafts.discard(activeKey);
    focus.current = null;
    setError('');
    setNotice('');
    setActiveKey(requested);
  }, [schema, requested, activeKey, dirty, pending, setParams, drafts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts this GET.
  useEffect(() => {
    if (!definition) return;
    const initial = drafts.get(definition.key);
    if (initial && (initial.pending || JSON.stringify(initial.template) !== initial.baseline)) {
      if (!initial.pending)
        setNotice(
          'Rascunho restaurado nesta sessão. Navegar pelo painel não descarta suas alterações.',
        );
      return;
    }
    const controller = new AbortController();
    setError('');
    const options = adminApiOptions();
    void request<BotResponseTemplateDto>(
      `/v1/admin/bot-responses/${encodeURIComponent(definition.key)}`,
      { ...options, method: 'GET', signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted || drafts.get(definition.key) !== initial) return;
        drafts.load(definition.key, result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && drafts.get(definition.key) === initial)
          setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [definition, retry, drafts]);

  function editTemplate(next: Template) {
    edit(next as BotResponseTemplateDto);
  }

  function edit(next: BotResponseTemplateDto) {
    drafts.edit(activeKey, next);
    setNotice('');
    setError('');
  }

  function select(key: string) {
    setParams((current) => {
      current.set('resposta', key);
      return current;
    });
  }

  function insert(token: string) {
    const target = focus.current;
    if (!target || !target.element.isConnected || target.element.disabled) {
      setNotice('Selecione um campo de texto antes de inserir uma variável.');
      return;
    }
    const { element, change } = target;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const value = element.value.slice(0, start) + token + element.value.slice(end);
    if (element.maxLength >= 0 && value.length > element.maxLength) {
      setNotice('A variável ultrapassa o limite deste campo.');
      return;
    }
    change(value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!template || !definition || pending) return;
    const validation = validateTemplate(definition as Definition, template as Template);
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setNotice('');
    await drafts.save(
      definition.key,
      (snapshot) => {
        const options = adminApiOptions();
        return request<BotResponseTemplateDto>(
          `/v1/admin/bot-responses/${encodeURIComponent(definition.key)}`,
          {
            ...options,
            method: 'PUT',
            headers: { ...options.headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot),
          },
        );
      },
      errorMessage,
    );
  }

  return (
    <section className="bot-responses" aria-labelledby="responses-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Operação / Discord</p>
          <h1 className="page-title" id="responses-title">
            <AdminIcon className="page-title-icon" name="assistant" />
            <span>Respostas do bot</span>
          </h1>
          <p>Personalize cada resultado sem alterar as regras dos comandos.</p>
        </div>
      </header>
      {schemaError ? (
        <div role="alert">
          <p className="form-error">{schemaError}</p>
          <button
            type="button"
            className="ops-button"
            onClick={() => setSchemaRetry((value) => value + 1)}
          >
            Tentar carregar catálogo novamente
          </button>
        </div>
      ) : !schema ? (
        <output>Carregando catálogo…</output>
      ) : !schema.length ? (
        <output>Nenhuma resposta disponível no catálogo.</output>
      ) : (
        <>
          <div className="response-catalog cards-panel">
            <label className="response-field">
              Comando
              <select
                aria-label="Comando"
                disabled={pending}
                value={definition?.command ?? ''}
                onChange={(event) => {
                  const first = schema.find((item) => item.command === event.target.value);
                  if (first) select(first.key);
                }}
              >
                <option value="" disabled>
                  Selecione um comando
                </option>
                {[...new Set(schema.map((item) => item.command))].map((command) => (
                  <option key={command} value={command}>
                    {command}
                  </option>
                ))}
              </select>
            </label>
            <label className="response-field">
              Resultado
              <select
                aria-label="Resultado"
                disabled={pending || !definition}
                value={definition?.key ?? ''}
                onChange={(event) => select(event.target.value)}
              >
                <option value="" disabled>
                  Selecione uma resposta
                </option>
                {schema
                  .filter((item) => item.command === definition?.command)
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              {definition?.description ??
                'Resposta não encontrada. Selecione um comando do catálogo.'}
            </p>
          </div>
          {error && !template && (
            <div role="alert">
              <p className="form-error">{error}</p>
              <button
                type="button"
                className="ops-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Tentar carregar resposta novamente
              </button>
            </div>
          )}
          {definition && !template && !error && <output>Carregando resposta…</output>}
          {definition && template && (
            <TemplateAssets.Provider value={assets}>
              <div className="response-workbench">
                <form
                  className="response-editor cards-panel"
                  onSubmit={(event) => void save(event)}
                  aria-busy={pending}
                >
                  <fieldset className="response-editor-fields" disabled={pending}>
                    <div className="response-mode">
                      <label className="response-field">
                        Formato
                        <select
                          aria-label="Formato"
                          value={template.mode}
                          onChange={(event) => {
                            const mode = event.target.value as BotResponseTemplateDto['mode'];
                            if (mode === template.mode) return;
                            if (
                              !window.confirm(
                                mode === 'components_v2'
                                  ? 'Trocar para Components V2? O conteúdo e todos os embeds serão removidos do rascunho. Linhas de botões serão mantidas. A alteração só será publicada ao salvar.'
                                  : 'Trocar para legado? Textos, mídias, separadores e containers (incluindo seus botões) serão removidos do rascunho. Apenas linhas de botões no nível principal serão mantidas. A alteração só será publicada ao salvar.',
                              )
                            )
                              return;
                            focus.current = null;
                            edit(changeMode(template, mode));
                          }}
                        >
                          <option value="legacy">Legado: conteúdo, embeds e botões</option>
                          <option value="components_v2">Components V2</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Substituir o rascunho pelo modelo padrão do catálogo? A alteração só será publicada ao salvar.',
                            )
                          ) {
                            focus.current = null;
                            edit(structuredClone(definition.defaultTemplate));
                          }
                        }}
                      >
                        Usar padrão
                      </button>
                    </div>
                    <p className="response-note">
                      Components V2 não pode ser misturado com conteúdo ou embeds. Campos opcionais
                      podem ficar vazios.
                    </p>
                    <p className="response-note">
                      Rascunhos ficam em memória ao navegar pelo painel. Sair da conta ou recarregar
                      a página encerra essa sessão de edição.
                    </p>
                    <details className="response-variables" open>
                      <summary>
                        Variáveis ({definition.variables.length + definition.lists.length})
                      </summary>
                      <p>
                        Foque um campo de texto e clique para inserir. Filtros:{' '}
                        {Object.entries(pipes).map(([pipe, description]) => (
                          <code key={pipe} title={description}>
                            |{pipe}{' '}
                          </code>
                        ))}
                        — ex.: <code>{'{balance|number}'}</code>.
                      </p>
                      <div>
                        {definition.variables.map((variable) => (
                          <button
                            type="button"
                            key={variable.token}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => insert(variable.token)}
                            title={variable.description}
                          >
                            <code>{variable.token}</code>
                            <span>{variable.description}</span>
                            <small>Exemplo: {variable.example}</small>
                          </button>
                        ))}
                        {entry?.lists.map((list) => (
                          <button
                            type="button"
                            key={list.name}
                            data-kind="list"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => insert(`{${list.name}}`)}
                            title={`Lista formatada na aba Listas: ${list.description}`}
                          >
                            <code>{`{${list.name}}`}</code>
                            <span>Lista: {list.description}</span>
                            <small>
                              {list.examples.length} itens de exemplo ·{' '}
                              <code>{`{${list.name}|count}`}</code>
                            </small>
                          </button>
                        ))}
                      </div>
                      {emojis.length === 0 && (
                        <p>
                          Use <code>{'{emoji:nome}'}</code> para emojis do bot.{' '}
                          <Link to="/app/emojis">Cadastrar emojis do bot</Link>
                        </p>
                      )}
                      {emojis.length > 0 && (
                        <div className="emoji-palette" aria-label="Emojis do bot">
                          {emojis.map((emoji) => (
                            <button
                              type="button"
                              key={emoji.id}
                              title={`{emoji:${emoji.name}}`}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => insert(`{emoji:${emoji.name}}`)}
                            >
                              <img src={emoji.imageUrl} alt={`:${emoji.name}:`} />
                            </button>
                          ))}
                        </div>
                      )}
                    </details>
                    <div className="response-tabs" role="tablist" aria-label="Seções do editor">
                      {(
                        [
                          ['message', 'Mensagem'],
                          ['lists', `Listas (${entry?.lists.length ?? 0})`],
                          ['images', `Imagens (${current?.images?.length ?? 0})`],
                        ] as const
                      ).map(([id, text]) => (
                        <button
                          type="button"
                          role="tab"
                          key={id}
                          aria-selected={tab === id}
                          onClick={() => {
                            focus.current = null;
                            setTab(id);
                          }}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                    {tab === 'lists' && entry && scope && current && (
                      <ListsEditor
                        definition={entry}
                        formats={current.lists ?? []}
                        scope={scope}
                        focus={focus}
                        insert={insert}
                        onChange={(lists) => editTemplate({ ...current, lists })}
                      />
                    )}
                    {tab === 'images' && entry && scope && current && (
                      <ImageDesigner
                        images={current.images ?? []}
                        definition={entry}
                        scope={scope}
                        focus={focus}
                        insert={insert}
                        onChange={(images) => editTemplate({ ...current, images })}
                        onUse={(ref) => {
                          editTemplate(attachImage(current, ref));
                          setTab('message');
                          setNotice('Imagem adicionada à mensagem.');
                        }}
                      />
                    )}
                    {tab === 'message' && (
                      <>
                        {template.mode === 'legacy' && (
                          <LegacyEditor template={template} onChange={edit} focus={focus} />
                        )}
                        <h2>
                          {template.mode === 'legacy' ? 'Linhas de botões' : 'Blocos visuais'}{' '}
                          <small>
                            {template.mode === 'legacy'
                              ? `${template.components.length}/5`
                              : `${componentCount(template.components)}/40 componentes`}
                          </small>
                        </h2>
                        <ComponentsEditor
                          components={template.components}
                          definition={definition}
                          focus={focus}
                          legacy={template.mode === 'legacy'}
                          onChange={(components) => edit({ ...template, components })}
                        />
                      </>
                    )}
                  </fieldset>
                  <div className="response-save">
                    <output>
                      {pending
                        ? 'Salvando…'
                        : dirty
                          ? 'Alterações não salvas'
                          : 'Sem alterações pendentes'}
                    </output>
                    <button
                      className="ops-button accent"
                      type="submit"
                      disabled={pending || !dirty}
                    >
                      {pending ? 'Salvando…' : 'Salvar resposta'}
                    </button>
                  </div>
                  {(error || draft?.error) && (
                    <p className="form-error" role="alert">
                      {error || draft?.error}
                    </p>
                  )}
                  <output>{notice || draft?.notice}</output>
                </form>
                {scope && current && (
                  <Preview
                    template={current}
                    scope={scope}
                    simulation={simulation}
                    onSimulation={setSimulation}
                    hasLists={Boolean(entry?.lists.length)}
                  />
                )}
              </div>
            </TemplateAssets.Provider>
          )}
        </>
      )}
    </section>
  );
}
