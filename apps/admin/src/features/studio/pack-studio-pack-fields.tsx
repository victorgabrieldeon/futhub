import type { ChangeEvent } from 'react';
import type { PackStudioFieldsProps } from './pack-studio-inspector';

function numberValue(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function PackStudioFields({ draft, onChange }: PackStudioFieldsProps) {
  const changeNumber =
    (key: 'cardsAmount' | 'limitPerUser' | 'price') => (event: ChangeEvent<HTMLInputElement>) =>
      onChange(key, numberValue(event.target.value, draft[key]));
  return (
    <>
      <section className="studio-section">
        <h3 className="studio-section__title">Identidade</h3>
        <label className="studio-field">
          <span className="studio-field__label">Nome</span>
          <input onChange={(event) => onChange('name', event.target.value)} value={draft.name} />
        </label>
      </section>
      <section className="studio-section">
        <h3 className="studio-section__title">Oferta</h3>
        <div className="studio-field-row studio-field-row--3">
          <label className="studio-field">
            <span className="studio-field__label">Cartas</span>
            <input
              min="1"
              onChange={changeNumber('cardsAmount')}
              type="number"
              value={draft.cardsAmount}
            />
          </label>
          <label className="studio-field">
            <span className="studio-field__label">Preço</span>
            <input min="0" onChange={changeNumber('price')} type="number" value={draft.price} />
          </label>
          <label className="studio-field">
            <span className="studio-field__label">Limite</span>
            <input
              min="0"
              onChange={changeNumber('limitPerUser')}
              type="number"
              value={draft.limitPerUser}
            />
          </label>
        </div>
        <small className="studio-field__hint">
          Probabilidades e elegibilidade seguem em Gestão avançada.
        </small>
      </section>
    </>
  );
}

export function PackStudioContentFields({ draft }: PackStudioFieldsProps) {
  return (
    <section className="studio-section">
      <h3 className="studio-section__title">Resumo da oferta</h3>
      <dl className="studio-facts studio-facts--large">
        <div>
          <dt>Cartas por pack</dt>
          <dd>{draft.cardsAmount}</dd>
        </div>
        <div>
          <dt>Preço de abertura</dt>
          <dd>{draft.price.toLocaleString('pt-BR')} moedas</dd>
        </div>
        <div>
          <dt>Limite por jogador</dt>
          <dd>{draft.limitPerUser}</dd>
        </div>
      </dl>
      <small className="studio-field__hint">
        Pool de jogadores, raridades e chances continuam em Gestão avançada. O blueprint completo
        entra quando as regras de sorteio forem editáveis aqui.
      </small>
    </section>
  );
}
