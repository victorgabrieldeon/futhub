import type { ChangeEvent } from 'react';
import type { PackStudioFieldsProps } from './pack-studio-inspector';

function numberValue(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function PackStudioFields({
  draft,
  loading,
  packs,
  selectedId,
  onChoosePack,
  onChange,
}: PackStudioFieldsProps) {
  const changeNumber =
    (key: 'cardsAmount' | 'limitPerUser' | 'price') => (event: ChangeEvent<HTMLInputElement>) =>
      onChange(key, numberValue(event.target.value, draft[key]));
  return (
    <div className="pack-studio-fields">
      <label>
        Pack em edição
        <select
          disabled={loading}
          onChange={(event) => onChoosePack(event.target.value)}
          value={selectedId}
        >
          <option value="">Novo pack</option>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nome
        <input onChange={(event) => onChange('name', event.target.value)} value={draft.name} />
      </label>
      <div className="pack-studio-grid">
        <label>
          Cartas
          <input
            min="1"
            onChange={changeNumber('cardsAmount')}
            type="number"
            value={draft.cardsAmount}
          />
        </label>
        <label>
          Preço
          <input min="0" onChange={changeNumber('price')} type="number" value={draft.price} />
        </label>
        <label>
          Limite
          <input
            min="0"
            onChange={changeNumber('limitPerUser')}
            type="number"
            value={draft.limitPerUser}
          />
        </label>
      </div>
      <p className="form-note">Probabilidades e elegibilidade seguem em Gestão avançada.</p>
    </div>
  );
}

export function PackStudioContentFields({ draft }: PackStudioFieldsProps) {
  return (
    <div className="pack-studio-fields">
      <p className="pack-studio-content-card">
        <strong>{draft.cardsAmount} cartas</strong>
        <span>Oferta configurada</span>
      </p>
      <p className="pack-studio-content-card">
        <strong>{draft.price.toLocaleString('pt-BR')} moedas</strong>
        <span>Preço de abertura</span>
      </p>
      <p className="form-note">
        Pool de jogadores, raridades e chances continuam em Gestão avançada. Blueprint completo
        entra quando regras de sorteio forem editáveis aqui.
      </p>
    </div>
  );
}
