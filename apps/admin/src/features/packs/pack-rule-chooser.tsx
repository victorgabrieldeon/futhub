import { type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { RuleTokens } from './pack-rule-tokens';

export type PackRuleKey =
  | 'onlyPositions'
  | 'excludedPositions'
  | 'onlyCollectionIds'
  | 'excludedCollectionIds'
  | 'onlyCardIds'
  | 'excludedCardIds'
  | 'onlyTeamIds'
  | 'excludedTeamIds';

export type PackRuleOption = Readonly<{ id: string; label: string; meta?: string }>;
export type PackRuleOptionPage = Readonly<{
  options: readonly PackRuleOption[];
  total: number;
}>;
export type PackRuleOptionLoader = (page: number, query: string) => Promise<PackRuleOptionPage>;

const optionsPerPage = 24;
const scrollEndThreshold = 12;

type RuleChooserProps = Readonly<{
  excluded: readonly string[];
  excludedKey: PackRuleKey;
  only: readonly string[];
  onlyKey: PackRuleKey;
  onChange: (
    onlyKey: PackRuleKey,
    excludedKey: PackRuleKey,
    id: string,
    target: 'only' | 'excluded',
  ) => void;
  onTargetChange: (
    onlyKey: PackRuleKey,
    excludedKey: PackRuleKey,
    target: 'only' | 'excluded',
  ) => void;
  loadOptions?: PackRuleOptionLoader;
  options: readonly PackRuleOption[];
  title: string;
}>;

export function RuleChooser({
  excluded,
  excludedKey,
  only,
  onlyKey,
  onChange,
  onTargetChange,
  loadOptions,
  options,
  title,
}: RuleChooserProps) {
  const [query, setQuery] = useState('');
  const [loadedOptions, setLoadedOptions] = useState(options);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [selectionTarget, setSelectionTarget] = useState<'only' | 'excluded'>(() =>
    excluded.length ? 'excluded' : 'only',
  );
  const [total, setTotal] = useState(options.length);
  const [visibleOptionCount, setVisibleOptionCount] = useState(optionsPerPage);
  const requestId = useRef(0);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return term
      ? options.filter((option) =>
          `${option.label} ${option.meta ?? ''}`.toLocaleLowerCase('pt-BR').includes(term),
        )
      : options;
  }, [options, query]);
  const selected = selectionTarget === 'only' ? only : excluded;
  const visibleOptions = loadOptions ? loadedOptions : matches.slice(0, visibleOptionCount);
  const selectedOptions = useMemo(
    () => [
      ...options,
      ...loadedOptions.filter((option) => !options.some(({ id }) => id === option.id)),
    ],
    [loadedOptions, options],
  );
  const hasMoreOptions = loadOptions
    ? loadedOptions.length < total
    : visibleOptionCount < matches.length;

  useEffect(() => {
    if (!loadOptions) return;

    let active = true;
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setLoading(true);
    setLoadError('');
    void loadOptions(1, query)
      .then((result) => {
        if (!active || requestId.current !== currentRequestId) return;
        setLoadedOptions(result.options);
        setPage(1);
        setTotal(result.total);
      })
      .catch((error) => {
        if (!active || requestId.current !== currentRequestId) return;
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar opções.');
      })
      .finally(() => {
        if (active && requestId.current === currentRequestId) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadOptions, query]);

  function loadMoreOptions(event: UIEvent<HTMLSelectElement>) {
    const menu = event.currentTarget;
    const distanceToEnd = menu.scrollHeight - menu.scrollTop - menu.clientHeight;
    if (!hasMoreOptions || loading || distanceToEnd > scrollEndThreshold) return;

    if (loadOptions) {
      const nextPage = page + 1;
      const currentRequestId = requestId.current;
      setLoading(true);
      setLoadError('');
      void loadOptions(nextPage, query)
        .then((result) => {
          if (requestId.current !== currentRequestId) return;
          setLoadedOptions((current) => [
            ...current,
            ...result.options.filter((option) => !current.some(({ id }) => id === option.id)),
          ]);
          setPage(nextPage);
          setTotal(result.total);
        })
        .catch((error) => {
          if (requestId.current !== currentRequestId) return;
          setLoadError(
            error instanceof Error ? error.message : 'Não foi possível carregar opções.',
          );
        })
        .finally(() => {
          if (requestId.current === currentRequestId) setLoading(false);
        });
      return;
    }

    setVisibleOptionCount((current) => Math.min(current + optionsPerPage, matches.length));
  }

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleOptionCount(optionsPerPage);
  }

  function changeTarget(target: 'only' | 'excluded') {
    setSelectionTarget(target);
    onTargetChange(onlyKey, excludedKey, target);
  }

  return (
    <section className="pack-rule">
      <div className="pack-rule__heading">
        <h3>{title}</h3>
        <p>Escolha incluir ou bloquear. Mudar direção limpa a lista anterior.</p>
      </div>
      <div className="pack-rule__selected">
        <RuleTokens
          ids={selected}
          label={selectionTarget === 'only' ? 'Incluir' : 'Bloquear'}
          onRemove={(id) => onChange(onlyKey, excludedKey, id, selectionTarget)}
          options={selectedOptions}
          tone={selectionTarget}
        />
      </div>
      <div className="pack-rule__controls">
        <label className="pack-rule__search">
          <span className="sr-only">Buscar em {title}</span>
          <input
            onChange={(event) => updateQuery(event.target.value)}
            placeholder={`Buscar ${title.toLocaleLowerCase('pt-BR')}`}
            type="search"
            value={query}
          />
        </label>
        <div
          aria-label={`Ação para ${title.toLocaleLowerCase('pt-BR')}`}
          className="pack-rule__target"
        >
          <button
            aria-pressed={selectionTarget === 'only'}
            className="pack-rule__choice is-allowed"
            onClick={() => changeTarget('only')}
            type="button"
          >
            Incluir
          </button>
          <button
            aria-pressed={selectionTarget === 'excluded'}
            className="pack-rule__choice is-blocked"
            onClick={() => changeTarget('excluded')}
            type="button"
          >
            Bloquear
          </button>
        </div>
      </div>
      <select
        aria-label={`Selecionar ${title.toLocaleLowerCase('pt-BR')}`}
        className="pack-rule__select"
        onChange={(event) => {
          if (event.target.value)
            onChange(onlyKey, excludedKey, event.target.value, selectionTarget);
        }}
        onScroll={loadMoreOptions}
        size={8}
        value=""
      >
        <option disabled value="">
          Selecione para {selectionTarget === 'only' ? 'incluir' : 'bloquear'}
        </option>
        {visibleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.meta ? `${option.label} · ${option.meta}` : option.label}
          </option>
        ))}
      </select>
      {visibleOptions.length === 0 && !loading && (
        <p className="pack-rule__empty">Nenhum resultado.</p>
      )}
      {loadError && <p className="form-error">{loadError}</p>}
      {loading && <p className="pack-rule__more">Carregando opções...</p>}
      {hasMoreOptions && !loading && (
        <p className="pack-rule__more">Role para carregar mais opções.</p>
      )}
      {selected.length > 0 && (
        <p className="pack-rule__count">{selected.length} itens configurados</p>
      )}
    </section>
  );
}
