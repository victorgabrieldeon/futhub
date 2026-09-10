import {
  ApiClientError,
  type BotResponseDefinitionDto,
  type BotResponseTemplateDto,
  request,
} from '@futhub/api-client';
import {
  type FormEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import { ComponentsEditor, LegacyEditor, type TextFocus } from './editor';
import {
  type BotResponseComponentDto,
  changeMode,
  componentCount,
  createResponseDrafts,
  exampleText,
  previewUrl,
  templateError,
} from './helpers';
import './bot-responses.css';

function PreviewImage({ url, description = '' }: { url: string; description?: string }) {
  const [failed, setFailed] = useState(false);
  const src = previewUrl(url);
  if (!url) return null;
  if (!src || failed)
    return (
      <p className="response-image-fallback">{description || 'Imagem'}: prévia indisponível</p>
    );
  return (
    <img
      src={src}
      alt={description}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function PreviewBlocks({
  components,
  definition,
}: { components: BotResponseComponentDto[]; definition: BotResponseDefinitionDto }) {
  const text = (value: string) => exampleText(value, definition.variables);
  return (
    <>
      {components.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows template order.
              <p className="response-preview-text" key={index}>
                {text(block.content)}
              </p>
            );
          case 'separator':
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows template order.
                key={index}
                className="response-preview-separator"
                style={{ paddingBlock: block.spacing === 2 ? 16 : 8 }}
              >
                {block.divider && <hr />}
              </div>
            );
          case 'media':
            return (
              <PreviewImage
                key={`${index}-${text(block.url)}`}
                url={text(block.url)}
                description={text(block.description)}
              />
            );
          case 'row':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows template order.
              <div className="response-preview-buttons" key={index}>
                {block.buttons.map((button, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: Preview buttons have no actions or local state.
                    key={i}
                    className="response-preview-button"
                    data-style={button.style}
                    data-disabled={button.disabled}
                    title={button.disabled ? 'Desabilitado' : 'Simulação, sem ação'}
                  >
                    {text(button.label) ||
                      definition.actions.find((action) => action.id === button.action)?.label ||
                      'Sem rótulo'}
                    {button.style === 'link' ? ' ↗' : ''}
                  </span>
                ))}
              </div>
            );
          case 'container':
            return (
              <div
                className="response-preview-container"
                // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows template order.
                key={index}
                style={{
                  borderLeftColor: /^#[\da-f]{6}$/i.test(block.color) ? block.color : undefined,
                }}
              >
                <PreviewBlocks components={block.components} definition={definition} />
              </div>
            );
        }
      })}
    </>
  );
}

function Preview({
  template,
  definition,
}: { template: BotResponseTemplateDto; definition: BotResponseDefinitionDto }) {
  const text = (value: string) => exampleText(value, definition.variables);
  return (
    <aside className="response-preview" aria-label="Prévia aproximada da resposta">
      <header>
        <p className="eyebrow">Prévia ao vivo</p>
        <h2>Resposta no Discord</h2>
        <p>
          Exemplos do catálogo. Markdown e layout aproximados. Nenhuma mensagem ou ação é enviada.
        </p>
      </header>
      <div className="response-preview-message">
        <p className="response-preview-author">
          FutHub <small>APP</small>
        </p>
        {template.mode === 'legacy' && (
          <>
            {template.content && <p className="response-preview-text">{text(template.content)}</p>}
            {template.embeds.map((embed, index) => {
              const authorName = text(embed.authorName ?? '');
              const authorUrl = previewUrl(text(embed.authorUrl ?? ''));
              const authorIconUrl = text(embed.authorIconUrl ?? '');
              return (
                <article
                  className="response-preview-embed"
                  // biome-ignore lint/suspicious/noArrayIndexKey: Preview images are separately keyed by their URL.
                  key={index}
                  style={{
                    borderLeftColor: /^#[\da-f]{6}$/i.test(embed.color) ? embed.color : undefined,
                  }}
                >
                  {embed.thumbnailUrl && (
                    <div className="response-preview-thumbnail">
                      <PreviewImage
                        key={text(embed.thumbnailUrl)}
                        url={text(embed.thumbnailUrl)}
                        description="Miniatura"
                      />
                    </div>
                  )}
                  {authorName && (
                    <div className="response-preview-embed-author">
                      <PreviewImage url={authorIconUrl} description="Ícone do autor" />
                      {authorUrl ? (
                        <a href={authorUrl} target="_blank" rel="noreferrer">
                          {authorName}
                        </a>
                      ) : (
                        <strong>{authorName}</strong>
                      )}
                    </div>
                  )}
                  {embed.title && <h3>{text(embed.title)}</h3>}
                  {embed.description && (
                    <p className="response-preview-text">{text(embed.description)}</p>
                  )}
                  <dl className="response-preview-fields">
                    {embed.fields.map((field, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows template order.
                      <div key={i} data-inline={field.inline}>
                        <dt>{text(field.name)}</dt>
                        <dd>{text(field.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <PreviewImage key={text(embed.imageUrl)} url={text(embed.imageUrl)} />
                  {embed.footer && <footer>{text(embed.footer)}</footer>}
                </article>
              );
            })}
          </>
        )}
        <PreviewBlocks components={template.components} definition={definition} />
      </div>
      {definition.key === 'pack.shop' && (
        <p className="response-note">
          O bot acrescenta controles de inspeção dos itens e paginação da loja. Eles não são botões
          estáticos editáveis nesta tela.
        </p>
      )}
    </aside>
  );
}

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
    const validation = templateError(template, definition);
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
                    Rascunhos ficam em memória ao navegar pelo painel. Sair da conta ou recarregar a
                    página encerra essa sessão de edição.
                  </p>
                  <details className="response-variables" open>
                    <summary>Variáveis disponíveis ({definition.variables.length})</summary>
                    <p>Foque um campo de texto; clique em uma variável para inseri-la no cursor.</p>
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
                    </div>
                  </details>
                  {definition.key === 'pack.shop' && (
                    <p className="response-note">
                      Inspeção dos itens e paginação são geradas pelo bot, não por estes botões
                      estáticos.
                    </p>
                  )}
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
                </fieldset>
                <div className="response-save">
                  <output>
                    {pending
                      ? 'Salvando…'
                      : dirty
                        ? 'Alterações não salvas'
                        : 'Sem alterações pendentes'}
                  </output>
                  <button className="ops-button accent" type="submit" disabled={pending || !dirty}>
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
              <Preview template={template} definition={definition} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
