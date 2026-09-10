import type { PackRuleOption } from './pack-rule-chooser';

export function RuleTokens({
  ids,
  label,
  onRemove,
  options,
  tone,
}: Readonly<{
  ids: readonly string[];
  label: string;
  onRemove: (id: string) => void;
  options: readonly PackRuleOption[];
  tone: 'only' | 'excluded';
}>) {
  const selected = ids.map(
    (id): PackRuleOption =>
      options.find((option) => option.id === id) ?? {
        id,
        label: `Item ${id.slice(0, 8)}…`,
        meta: 'Carregue a lista para ver o nome.',
      },
  );

  return (
    <div className={`pack-rule__tokens is-${tone}`}>
      <span>{label}</span>
      {selected.length ? (
        selected.map((option) => (
          <button
            aria-label={`Remover ${option.label}`}
            key={option.id}
            onClick={() => onRemove(option.id)}
            title={option.meta}
            type="button"
          >
            {option.label} ×
          </button>
        ))
      ) : (
        <em>Nenhum</em>
      )}
    </div>
  );
}
